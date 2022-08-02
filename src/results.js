import { EXTRACT_OK } from './const';

/*
 * In brace-server, a manualResult needs to be completed
 *   except its title which can be derived from url path
 *   because here just gets and returns.
 */
export const manualResults = {
  'www.wsj.com': {
    url: 'https://www.wsj.com',
    extractedDT: 1632721185359,
    status: EXTRACT_OK,
    title: 'The Wall Street Journal - Breaking News, Business, Financial & Economic News, World News and Video',
    image: 'https://storage.googleapis.com/brace-static-files/tQHZLQf118qdEW6ZQccpqXdFGiXjaJJYw9E51h3JM52mmAPN.png',
    favicon: 'https://www.wsj.com/favicon.ico',
  },
  'www.newstatesman.com': {
    url: 'https://www.newstatesman.com',
    extractedDT: 1632721185359,
    status: EXTRACT_OK,
    title: 'The New Statesman - Global Current Affairs, Politics & Culture',
    image: 'https://storage.googleapis.com/brace-static-files/T9FBbGYYm79APz4ta47GdUAuia5qyFByROWCYU5ZhgVQSYPp.png',
    favicon: 'https://www.newstatesman.com/favicon.ico',
  },
};
