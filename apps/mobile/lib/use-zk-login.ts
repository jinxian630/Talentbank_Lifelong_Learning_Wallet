import { prepareZkLogin, completeZkLogin } from './zk-login';

export function useZkLogin() {
  return { prepareZkLogin, completeZkLogin };
}
