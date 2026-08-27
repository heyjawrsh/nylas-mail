import {describe, it, expect} from 'vitest';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const {createLogger} = require('../logger');
const {testStream} = require('../log-streams');

const flush = () => new Promise((resolve) => setImmediate(resolve))

describe("createLogger", () => {
  it("should log msgs correctly", async () => {
    const globalLogger = createLogger("specs");

    globalLogger.info('default log');
    await flush();
    let parsedLog = JSON.parse(testStream.stream.toString());
    expect(parsedLog.msg).toEqual('default log');
    testStream.stream.reset();

    const childLogger = globalLogger.child({child: true});
    childLogger.info('child logger');
    await flush();
    parsedLog = JSON.parse(testStream.stream.toString());
    expect(parsedLog.child).toEqual(true);
    testStream.stream.reset();

    const fakeAccount = {
      id: 'abcde',
      emailAddress: 'ben.bitdiddle@mit.edu',
      provider: 'imap',
    };
    const loggerForAccount = globalLogger.forAccount(fakeAccount, childLogger);
    loggerForAccount.info('log for account');
    await flush();
    parsedLog = JSON.parse(testStream.stream.toString());
    expect(parsedLog.account_id).toEqual(fakeAccount.id);
    expect(parsedLog.account_email).toEqual(fakeAccount.emailAddress);
    expect(parsedLog.account_provider).toEqual(fakeAccount.provider);
    expect(parsedLog.n1_id).toEqual('Not available');
    expect(parsedLog.child).toEqual(true);
    testStream.stream.reset();
  });
});
