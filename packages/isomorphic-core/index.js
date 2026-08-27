import { ImapFlow } from "imapflow";

import * as Errors from "./src/errors.js";
import * as IMAPErrors from "./src/imap-errors.js";
import * as SMTPErrors from "./src/smtp-errors.js";
import loadModels from "./src/load-models.js";
import * as AuthHelpers from "./src/auth-helpers.js";
import * as PromiseUtils from "./src/promise-utils.js";
import * as DatabaseTypes from "./src/database-types.js";
import IMAPConnection from "./src/imap-connection.js";
import IMAPConnectionPool from "./src/imap-connection-pool.js";
import * as MessageBodyUtils from "./src/message-body-utils.js";
import SendmailClient from "./src/sendmail-client.js";
import DeltaStreamBuilder from "./src/delta-stream-builder.js";
import HookTransactionLog from "./src/hook-transaction-log.js";
import HookIncrementVersionOnSave from "./src/hook-increment-version-on-save.js";
import {
	BackoffScheduler,
	ExponentialBackoffScheduler,
} from "./src/backoff-schedulers.js";
import { CommonProviderSettings } from "./vendor/imap-provider-settings/index.js";
import MetricsReporter from "./src/metrics-reporter.js";
import * as MessageUtils from "./src/message-utils.js";
import TrackingUtils from "./src/tracking-utils.js";
import ModelUtils from "./src/model-utils.js";
import * as StringUtils from "./src/string-utils.js";
import * as TLSUtils from "./src/tls-utils.js";
import * as DBUtils from "./src/db-utils.js";
import "./src/database-extensions.js";
import * as ShellUtils from "./src/shell-utils.js";

export {
	ImapFlow as Imap,
	Errors,
	IMAPErrors,
	SMTPErrors,
	loadModels,
	AuthHelpers,
	PromiseUtils,
	DatabaseTypes,
	IMAPConnection,
	IMAPConnectionPool,
	MessageBodyUtils,
	SendmailClient,
	DeltaStreamBuilder,
	HookTransactionLog,
	HookIncrementVersionOnSave,
	BackoffScheduler,
	ExponentialBackoffScheduler,
	CommonProviderSettings,
	MetricsReporter,
	MessageUtils,
	TrackingUtils,
	ModelUtils,
	StringUtils,
	TLSUtils,
	DBUtils,
	ShellUtils,
};

export const Provider = {
	Gmail: "gmail",
	IMAP: "imap",
};
