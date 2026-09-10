"""Check the EC2 service identity; opt in to small S3/SQS test writes.

Run as the API service user with its environment. Never prints credentials,
presigned URLs or AWS error bodies. Does not alter IAM, DB rows or existing files.
"""
from __future__ import annotations

import argparse
import json
import re
from urllib.parse import urlparse
from uuid import uuid4

import boto3
import requests
from botocore.config import Config
from botocore.exceptions import ClientError

class CheckFailed(Exception):
    pass


def attempt(report, name, action):
    try:
        action()
    except Exception as exc:
        # SDK/HTTP exceptions can contain credentials or signed URLs.
        if isinstance(exc, CheckFailed):
            reason = str(exc)
        elif isinstance(exc, ClientError):
            code = exc.response.get("Error", {}).get("Code", "ClientError")
            reason = code if re.fullmatch(r"[A-Za-z0-9_.-]{1,80}", code) else "ClientError"
        else:
            reason = type(exc).__name__
        report["checks"].append({"check": name, "status": "failed", "reason": reason})
        return False
    report["checks"].append({"check": name, "status": "passed"})
    return True


def run_checks(config, session, expected_role, *, write_test_probes=False, http_get=requests.get):
    report = {
        "mode": "test-writes" if write_test_probes else "identity-only",
        "checks": [], "created_keys": [], "probe_job_id": None,
        "not_checked": ["S3 read/write and signed download", "SQS send",
                        "school SQS receive/delete/visibility permissions", "school signed upload", "RDS", "GPU generation"],
    }
    client_config = Config(connect_timeout=5, read_timeout=10, retries={"total_max_attempts": 2})
    account = None

    def identity():
        nonlocal account, session
        if config.app_role != "api":
            raise CheckFailed("Run with the EC2 API service environment (APP_ROLE=api)")
        if session is None:
            session = boto3.Session()
        credentials = session.get_credentials()
        if credentials is None or credentials.method != "iam-role":
            raise CheckFailed("EC2 instance role is not selected; check environment/profile credential precedence")
        caller = session.client("sts", region_name=config.s3_region, config=client_config).get_caller_identity()
        account = caller.get("Account", "")
        expected = f"arn:aws:sts::{account}:assumed-role/{expected_role}/"
        if not re.fullmatch(r"\d{12}", account) or not caller.get("Arn", "").startswith(expected):
            raise CheckFailed("The selected role does not match --expected-role")

    if not attempt(report, "ec2-role", identity):
        return report
    if not write_test_probes:
        return report

    def targets():
        if not re.fullmatch(r"[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]", config.s3_bucket):
            raise CheckFailed("Set a valid S3_BUCKET in the API environment")
        if not re.fullmatch(r"[a-z0-9-]+", config.s3_region):
            raise CheckFailed("Set a valid S3_REGION")
        url = urlparse(config.character_queue_url)
        if (url.scheme != "https" or url.netloc != f"sqs.{config.s3_region}.amazonaws.com"
                or not re.fullmatch(rf"/{account}/[A-Za-z0-9_-]+", url.path)
                or url.query or url.fragment):
            raise CheckFailed("Set the same-account regional Standard CHARACTER_QUEUE_URL")

    if not attempt(report, "test-targets", targets):
        return report
    report["not_checked"].remove("S3 read/write and signed download")
    report["not_checked"].remove("SQS send")
    probe_id = uuid4().hex
    data = f"LeafLog access probe {probe_id}\n".encode("ascii")
    s3 = None

    def storage(prefix):
        nonlocal s3
        if s3 is None:
            s3 = session.client("s3", region_name=config.s3_region,
                                endpoint_url=f"https://s3.{config.s3_region}.amazonaws.com",
                                config=client_config.merge(Config(signature_version="s3v4")))
        key = f"{prefix}/_access-checks/{probe_id}.txt"
        s3.put_object(Bucket=config.s3_bucket, Key=key, Body=data,
                      ContentType="text/plain", IfNoneMatch="*")
        report["created_keys"].append(key)
        body = s3.get_object(Bucket=config.s3_bucket, Key=key)["Body"]
        try:
            if body.read(len(data) + 1) != data:
                raise CheckFailed("S3 probe contents did not match")
        finally:
            body.close()
        signed = s3.generate_presigned_url("get_object",
            Params={"Bucket": config.s3_bucket, "Key": key}, ExpiresIn=60)
        with http_get(signed, timeout=(5, 10), stream=True, allow_redirects=False) as response:
            if response.status_code != 200:
                raise CheckFailed(f"Signed download returned HTTP {response.status_code}")
            if response.raw.read(len(data) + 1) != data:
                raise CheckFailed("Signed download contents did not match")

    for prefix in ("leaflog/characters", "leaflog/diary", "diagnosis"):
        attempt(report, f"s3:{prefix}", lambda prefix=prefix: storage(prefix))

    def queue():
        # No matching DB job: the worker acknowledges it when generation is enabled.
        sqs = session.client("sqs", region_name=config.s3_region, config=client_config)
        sqs.send_message(QueueUrl=config.character_queue_url, MessageBody=json.dumps({"job_id": probe_id}),
                         DelaySeconds=0)
        report["probe_job_id"] = probe_id

    attempt(report, "sqs:send", queue)
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--expected-role", required=True, help="IAM role name attached to the API EC2")
    parser.add_argument("--write-test-probes", action="store_true",
                        help="Write three tiny S3 objects and one SQS message to the configured test resources")
    args = parser.parse_args()
    from app.config import settings
    report = run_checks(settings, None, args.expected_role, write_test_probes=args.write_test_probes)
    print(json.dumps(report, indent=2))
    return 1 if any(item["status"] == "failed" for item in report["checks"]) else 0


if __name__ == "__main__":
    raise SystemExit(main())
