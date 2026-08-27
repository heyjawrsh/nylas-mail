import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";

const NODE_ENV = process.env.NODE_ENV || "production";
const BUCKET_NAME = process.env.BUCKET_NAME;
const credentials =
	process.env.BUCKET_AWS_ACCESS_KEY_ID &&
	process.env.BUCKET_AWS_SECRET_ACCESS_KEY
		? {
				accessKeyId: process.env.BUCKET_AWS_ACCESS_KEY_ID,
				secretAccessKey: process.env.BUCKET_AWS_SECRET_ACCESS_KEY,
			}
		: undefined;

if (NODE_ENV !== "development" && (!BUCKET_NAME || !credentials)) {
	throw new Error("You need to define S3 access credentials.");
}

async function localUpload(account, data) {
	const uploadId = `${account.id}-${data.id}`;
	const directory = path.join("/tmp", "uploads");
	await mkdir(directory, { recursive: true });
	await pipeline(
		data.file,
		createWriteStream(path.join(directory, uploadId), { flags: "w+" }),
	);
	return { filename: data.file.hapi.filename };
}

async function s3Upload(account, data) {
	const client = new S3Client({ credentials });
	await client.send(
		new PutObjectCommand({
			Bucket: BUCKET_NAME,
			Key: `${account.id}-${data.id}`,
			Body: data.file._data,
		}),
	);
	return { filename: data.file.hapi.filename };
}

export default function registerBlobsRoutes(server) {
	server.route({
		method: ["PUT", "POST"],
		path: "/blobs",
		options: {
			description: "Upload a draft attachment to S3.",
			tags: ["drafts"],
			payload: {
				output: "stream",
				parse: true,
				maxBytes: 25 * 1048576,
				multipart: { output: "stream" },
				allow: "multipart/form-data",
			},
		},
		handler: async (request, h) => {
			const data = request.payload;
			const { account } = request.auth.credentials;
			if (!data.id || !data.file)
				return h
					.response({ error: "You need to supply a file and an id" })
					.code(400);
			try {
				const result =
					NODE_ENV === "development"
						? await localUpload(account, data)
						: await s3Upload(account, data);
				return JSON.stringify(result);
			} catch (error) {
				request.logger.error(error, "Error uploading attachment");
				return h
					.response({ type: "error", message: "Couldn't upload data" })
					.code(500);
			}
		},
	});
}

export { localUpload, s3Upload };
