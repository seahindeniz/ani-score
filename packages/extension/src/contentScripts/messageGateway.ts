import * as bridge from 'webext-bridge/content-script';

import { liveInterval } from '~/constants/main';
import { keepAlive } from '~/utils/keepAlive';

window.messageGateway = bridge;

keepAlive(() => {
  void bridge.sendMessage('get-stamp', Date.now()).catch(() => {});
  void browser.runtime
    .sendMessage({ 'get-stamp-2': Date.now() })
    .catch(() => {});
}, liveInterval);
