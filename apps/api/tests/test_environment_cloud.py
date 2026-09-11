from datetime import date, datetime, timezone
import traceback
import unittest
from unittest.mock import Mock, patch

import requests

from app import air_quality, asos, weather
from app.korea_time import KOREA_TIMEZONE


class EnvironmentCloudTests(unittest.TestCase):
    def setUp(self):
        for cache in (weather._cache, weather._ncst_cache, air_quality._station_cache,
                      air_quality._measurement_cache, air_quality._daily_cache):
            cache.clear()

    def operations(self):
        return [
            (weather, weather.WeatherFetchError, lambda: weather.fetch_ultra_short_forecast(60, 127)),
            (weather, weather.WeatherFetchError,
             lambda: weather._fetch_ultra_short_observation(60, 127, '20260908', '1000')),
            (air_quality, air_quality.AirQualityFetchError, lambda: air_quality.nearest_station(37.56, 126.97)),
            (air_quality, air_quality.AirQualityFetchError, lambda: air_quality.fetch_realtime_measurements('fixture')),
            (air_quality, air_quality.AirQualityFetchError,
             lambda: air_quality.fetch_daily_series('fixture', date(2026, 9, 1), date(2026, 9, 2))),
            (asos, asos.AsosFetchError,
             lambda: asos.fetch_daily_series(108, date(2026, 9, 1), date(2026, 9, 2))),
        ]

    def test_provider_failures_never_expose_key_or_raw_body(self):
        secret = 'fixture-private-service-key'
        for module, error_type, operation in self.operations():
            for failure in ('transport', 'json', 'provider'):
                with self.subTest(module=module.__name__, operation=operation, failure=failure):
                    response = Mock(text=secret)
                    if failure == 'json':
                        response.json.side_effect = ValueError(secret)
                    elif failure == 'provider':
                        response.json.return_value = {'response': {'header': {'resultCode': '30', 'resultMsg': secret}}}
                    get = Mock(return_value=response)
                    if failure == 'transport':
                        get.side_effect = requests.ReadTimeout('https://apis.data.go.kr/?serviceKey=' + secret)
                    with patch.object(module.requests, 'get', get):
                        try:
                            operation()
                        except error_type as exc:
                            rendered = ''.join(traceback.format_exception(exc))
                            self.assertNotIn(secret, str(exc))
                            self.assertNotIn(secret, rendered)
                        else:
                            self.fail('Expected a sanitized provider failure')
                    self.assertTrue(get.call_args.args[0].startswith('https://apis.data.go.kr/'))
                    self.assertIs(get.call_args.kwargs['allow_redirects'], False)

    def test_forecast_uses_korean_date_on_utc_server(self):
        now = datetime(2026, 9, 8, 15, 20, tzinfo=timezone.utc)
        clock = Mock()
        clock.now.side_effect = lambda tz: now.astimezone(tz)
        response = Mock()
        response.json.return_value = {'response': {'header': {'resultCode': '00'}, 'body': {'items': {'item': [
            {'category': category, 'fcstDate': '20260909', 'fcstTime': '0000', 'fcstValue': value}
            for category, value in [('SKY', '1'), ('PTY', '0'), ('T1H', '25'), ('REH', '60')]
        ]}}}}
        with patch.object(weather, 'datetime', clock), patch.object(weather.requests, 'get', return_value=response) as get:
            weather.fetch_ultra_short_forecast(60, 127)
        clock.now.assert_called_once_with(KOREA_TIMEZONE)
        self.assertEqual(get.call_args.kwargs['params']['base_date'], '20260908')
        self.assertEqual(get.call_args.kwargs['params']['base_time'], '2330')

    def test_hourly_series_starts_at_korean_midnight(self):
        now = datetime(2026, 9, 8, 15, 20, tzinfo=timezone.utc)
        clock = Mock()
        clock.now.side_effect = lambda tz: now.astimezone(tz)
        with patch.object(weather, 'datetime', clock), patch.object(weather, '_fetch_hourly_observation_cached', return_value=None) as fetch:
            self.assertEqual(weather.fetch_today_hourly_series(60, 127), [])
        clock.now.assert_called_once_with(KOREA_TIMEZONE)
        fetch.assert_called_once_with(60, 127, '20260909', '0000', is_final=False)


if __name__ == '__main__':
    unittest.main()
