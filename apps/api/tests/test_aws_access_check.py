"""Access probe tests use doubles only; no AWS credentials or connections."""
import io
import json
import unittest
from types import SimpleNamespace
from urllib.parse import urlparse
from unittest.mock import Mock, patch

import requests
from botocore.exceptions import ClientError, ProfileNotFound

from scripts.check_aws_access import run_checks


class ProbeTests(unittest.TestCase):
    def setUp(self):
        self.config = SimpleNamespace(app_role="api", s3_region="ap-northeast-2", s3_bucket="test-bucket",
            character_queue_url="https://sqs.ap-northeast-2.amazonaws.com/123456789012/test-queue")
        self.s3, self.sqs, self.sts = Mock(), Mock(), Mock()
        self.sts.get_caller_identity.return_value = {
            "Account": "123456789012", "Arn": "arn:aws:sts::123456789012:assumed-role/test-role/i-test",
        }
        self.session = Mock()
        self.session.get_credentials.return_value = SimpleNamespace(method="iam-role")
        self.session.client.side_effect = lambda name, **kw: {"sts": self.sts, "s3": self.s3, "sqs": self.sqs}[name]
        self.objects = {}

        def put(**kwargs):
            self.assertEqual(kwargs["IfNoneMatch"], "*")
            self.objects[kwargs["Key"]] = kwargs["Body"]
        self.s3.put_object.side_effect = put
        self.s3.get_object.side_effect = lambda **kw: {"Body": io.BytesIO(self.objects[kw["Key"]])}
        self.s3.generate_presigned_url.side_effect = lambda method, **kw: (
            "https://test-bucket.s3.ap-northeast-2.amazonaws.com/" + kw["Params"]["Key"] + "?secret-signature=hidden"
        )

        def get(url, **kwargs):
            self.assertFalse(kwargs["allow_redirects"])
            self.assertTrue(kwargs["stream"])
            self.assertEqual(kwargs["timeout"], (5, 10))
            response = Mock(status_code=200, raw=io.BytesIO(self.objects[urlparse(url).path.lstrip("/")]))
            response.__enter__ = Mock(return_value=response)
            response.__exit__ = Mock(return_value=False)
            return response
        self.http = Mock(side_effect=get)

    def run_check(self, writes=False):
        return run_checks(self.config, self.session, "test-role", write_test_probes=writes, http_get=self.http)

    def test_default_only_checks_identity(self):
        result = self.run_check()
        self.assertEqual(result["mode"], "identity-only")
        self.assertEqual(result["checks"], [{"check": "ec2-role", "status": "passed"}])
        self.assertIn("S3 read/write and signed download", result["not_checked"])
        self.s3.put_object.assert_not_called()
        self.sqs.send_message.assert_not_called()
        self.http.assert_not_called()

    def test_credentials_shadowing_role_stops_before_any_aws_call(self):
        for method in ("env", "shared-credentials-file", "assume-role"):
            with self.subTest(method=method):
                self.session.get_credentials.return_value = SimpleNamespace(method=method)
                self.assertEqual(self.run_check(True)["checks"][0]["status"], "failed")
        self.session.client.assert_not_called()

    def test_missing_profile_has_a_redacted_failure_report(self):
        with patch('scripts.check_aws_access.boto3.Session', side_effect=ProfileNotFound(profile='private-profile')):
            result = run_checks(self.config, None, 'test-role')
        self.assertEqual(result['checks'][0]['reason'], 'ProfileNotFound')
        self.assertNotIn('private-profile', json.dumps(result))

    def test_wrong_role_never_writes(self):
        self.sts.get_caller_identity.return_value["Arn"] = "arn:aws:sts::123456789012:assumed-role/other-role/session"
        self.assertEqual(self.run_check(True)["checks"][0]["status"], "failed")
        self.s3.put_object.assert_not_called()

    def test_wrong_region_account_and_fifo_queue_are_rejected_before_writing(self):
        for url in (
            "http://sqs.ap-northeast-2.amazonaws.com/123456789012/test-queue",
            "https://sqs.us-east-1.amazonaws.com/123456789012/test-queue",
            "https://sqs.ap-northeast-2.amazonaws.com/999999999999/test-queue",
            "https://sqs.ap-northeast-2.amazonaws.com/123456789012/test-queue.fifo",
        ):
            with self.subTest(url=url):
                self.config.character_queue_url = url
                self.assertEqual(self.run_check(True)["checks"][-1]["status"], "failed")
        self.s3.put_object.assert_not_called()
        self.sqs.send_message.assert_not_called()

    def test_opt_in_only_writes_unique_probe_objects_and_a_job_id_message(self):
        result = self.run_check(True)
        self.assertTrue(all(c["status"] == "passed" for c in result["checks"]))
        self.assertEqual(len(result["created_keys"]), 3)
        self.assertEqual(self.http.call_count, 3)
        for key in result["created_keys"]:
            self.assertIn("/_access-checks/", key)
            self.assertTrue(key.endswith(".txt"))
        self.assertEqual(json.loads(self.sqs.send_message.call_args.kwargs["MessageBody"]),
                         {"job_id": result["probe_job_id"]})
        self.assertEqual(self.sqs.send_message.call_args.kwargs["DelaySeconds"], 0)
        self.sqs.receive_message.assert_not_called()
        self.sqs.get_queue_attributes.assert_not_called()
        self.s3.list_objects_v2.assert_not_called()
        self.s3.delete_object.assert_not_called()
        self.assertIn("school SQS receive/delete/visibility permissions", result["not_checked"])
        again = self.run_check(True)
        self.assertTrue(set(again["created_keys"]).isdisjoint(result["created_keys"]))

    def test_aws_error_bodies_are_redacted_and_failed_keys_are_not_reported_as_created(self):
        self.s3.put_object.side_effect = ClientError({"Error": {"Code": "AccessDenied", "Message": "secret-value"}}, "PutObject")
        result = self.run_check(True)
        self.assertEqual(result["created_keys"], [])
        failures = [c for c in result["checks"] if c["status"] == "failed"]
        self.assertEqual(len(failures), 3)
        self.assertTrue(all(c["reason"] == "AccessDenied" for c in failures))
        self.assertNotIn("secret-value", json.dumps(result))

    def test_signed_url_generation_alone_does_not_count_as_success(self):
        self.http.side_effect = requests.ConnectionError("https://example.test?secret-signature=hidden")
        result = self.run_check(True)
        self.assertEqual(len(result["created_keys"]), 3)
        self.assertEqual(sum(c["status"] == "failed" for c in result["checks"]), 3)
        self.assertNotIn("secret-signature", json.dumps(result))


if __name__ == "__main__":
    unittest.main()
