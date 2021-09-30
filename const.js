module.exports.DATASTORE_KIND = 'ExtractedResult';
module.exports.BUCKET_NAME = 'brace-static-files';

module.exports.ALLOWED_ORIGINS = [
  'http://127.0.0.1:8080',
  'http://localhost:8080',
  'https://localhost:3000',
  'https://192.168.40.220:3000',
  'https://192.168.41.220:3000',
  'https://192.168.42.220:3000',
  'https://192.168.43.220:3000',
  'https://192.168.44.220:3000',
  'https://192.168.45.220:3000',
  'https://192.168.46.220:3000',
  'https://d2r7uroqj51uls.cloudfront.net',
  'https://brace.to',
];

module.exports.N_URLS = 10;
module.exports.N_EXTRACTS = 2;

module.exports.HTTP = 'http://';

module.exports.VALID_URL = 'VALID_URL';
module.exports.NO_URL = 'NO_URL';
module.exports.ASK_CONFIRM_URL = 'ASK_CONFIRM_URL';

module.exports.IGNORED_URL_PARAMS = ['utm_source', 'utm_medium', 'utm_term', 'utm_campaign', 'utm_brand', 'utm_social-type', 'utm_content'];

module.exports.PAGE_WIDTH = 1024;
module.exports.PAGE_HEIGHT = 597;

module.exports.EXTRACT_INIT = 'EXTRACT_INIT';
module.exports.EXTRACT_OK = 'EXTRACT_OK';
module.exports.EXTRACT_ERROR = 'EXTRACT_ERROR';
module.exports.EXTRACT_INVALID_URL = 'EXTRACT_INVALID_URL';
module.exports.EXTRACT_EXCEEDING_N_URLS = 'EXTRACT_EXCEEDING_N_URLS';

module.exports.DERIVED_VALUE = '00__--DERIVED_VALUE--__00';
