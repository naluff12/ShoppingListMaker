
import datetime
import pytz
import os

def now():
    tz_str = os.environ.get('TZ', 'UTC')
    tz = pytz.timezone(tz_str)
    return datetime.datetime.now(tz)
