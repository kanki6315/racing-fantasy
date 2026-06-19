# S3 + CloudFront asset bucket setup

**Created:** 2026-06-18 · **Method:** AWS Console · **Account:** Arjuna's personal AWS account

A runbook for the image/asset bucket: **private S3 bucket, global reads served via
CloudFront (Origin Access Control), writes from a single IAM user.** Nothing is publicly
readable straight from S3 — reads only flow through CloudFront; only the writer user (and
presigned URLs the API signs with its keys) can write.

## Resources created

| Resource | Value |
| --- | --- |
| S3 bucket | `race-fantasy-images` (region `us-east-1`) |
| Block Public Access | **All four flags ON** (bucket stays fully private) |
| Writer IAM user | `my-app-writer` — programmatic only, access keys issued |
| CloudFront OAC | auto-created by the "recommended origin settings" path |
| CloudFront distribution | serves reads at the distribution's `cloudfront.net` domain |

> All resources live in **Arjuna's personal AWS account**. Bucket/user names below are the
> real ones; account ID, distribution ID, and the CloudFront domain are omitted here — look
> them up in the console under that account when reviewing.

## Architecture

```
        write (PutObject, signed as my-app-writer)
 API ───────────────────────────────────────────────▶ ┌───────────────────────┐
                                                       │  S3: race-fantasy-    │
                                                       │  images  (PRIVATE,    │
                                                       │  BPA fully ON)        │
 World ──GET──▶ CloudFront (OAC) ──signed origin GET──▶└───────────────────────┘
                  dxxxx.cloudfront.net
```

- Direct S3 object URLs return **403** (private). Reads must go through CloudFront.
- Writes are authenticated as `my-app-writer`. Block Public Access does **not** interfere
  with presigned PUTs, because a presigned PUT is an authenticated (signed) request, not a
  public one.

## Steps followed (AWS Console)

### 1. Bucket
1. **S3 → Create bucket** → name `race-fantasy-images`, region `us-east-1`.
2. **Block Public Access**: left **all four boxes checked**.
3. Versioning **off**; default SSE-S3 encryption.

### 2. Writer IAM user
1. **IAM → Users → Create user** → `my-app-writer`, **no** console access (programmatic only).
2. Attached an inline least-privilege write policy (no `s3:GetObject` — the app writes, the
   public reads via CloudFront):
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [{
       "Sid": "WriteObjects",
       "Effect": "Allow",
       "Action": ["s3:PutObject", "s3:DeleteObject", "s3:AbortMultipartUpload"],
       "Resource": "arn:aws:s3:::race-fantasy-images/*"
     }]
   }
   ```
3. **Security credentials → Create access key → Application running outside AWS.** Secret
   shown once → stored in the app secret store. **Not committed to the repo.**

### 3. CloudFront distribution (with OAC)
1. **CloudFront → Create distribution → Specify origin.**
2. **Origin type:** Amazon S3. **S3 origin:** picked the bucket via the AWS picker, which
   resolved to the REST endpoint `race-fantasy-images.s3.us-east-1.amazonaws.com` (the
   correct endpoint — *not* the `s3-website` one).
3. **Origin settings:** used **"Use recommended origin settings"**. For an S3 origin this
   **auto-creates and attaches an OAC** (a manually pre-created OAC was deleted in favour of
   the auto-created one). Choosing "Customize origin settings" instead hides the managed OAC
   behavior and exposes raw custom-origin fields — avoid it for S3 origins.
4. **Viewer protocol policy:** Redirect HTTP to HTTPS. **Cache policy:** CachingOptimized.
5. Created the distribution. Its **distribution domain** (`*.cloudfront.net`) is the public
   read URL, and its **ARN** is used in the bucket policy below. Deploy took ~5–15 min.

### 4. Bucket policy (CloudFront read + writer write)
Set under **S3 → bucket → Permissions → Bucket policy**. Combines the CloudFront-generated
read statement (locked to *this* distribution via `AWS:SourceArn`) with the writer statement:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowCloudFrontRead",
      "Effect": "Allow",
      "Principal": { "Service": "cloudfront.amazonaws.com" },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::race-fantasy-images/*",
      "Condition": { "StringEquals": { "AWS:SourceArn": "<this distribution's ARN>" } }
    },
    {
      "Sid": "AllowWriterUser",
      "Effect": "Allow",
      "Principal": { "AWS": "<my-app-writer user ARN>" },
      "Action": ["s3:PutObject", "s3:DeleteObject", "s3:AbortMultipartUpload"],
      "Resource": "arn:aws:s3:::race-fantasy-images/*"
    }
  ]
}
```

> **Gotcha:** the recommended-origin path may offer to update the bucket policy for you with
> *only* the CloudFront read statement. If it overwrites, the `AllowWriterUser` statement is
> lost — after creation, re-check the bucket policy and confirm **both** statements are present.

## Verify

- Upload a test object (as admin) → **S3 object URL** in a browser returns **403** (private — correct).
- The CloudFront distribution domain `https://<...>.cloudfront.net/<key>` returns the object
  once the distribution finishes deploying.

## Not done yet / future

- **CORS** — not configured. Needed only for **browser** presigned uploads. Add under
  **S3 → bucket → Permissions → CORS** when the upload UI exists:
  ```json
  [{ "AllowedOrigins": ["https://your-frontend.example"], "AllowedMethods": ["PUT"], "AllowedHeaders": ["*"], "MaxAgeSeconds": 3000 }]
  ```
  Skip if uploads are server-to-server only.
- **Presigned uploads** — to be added to the API later. The API signs presigned PUTs with the
  `my-app-writer` keys; the URL inherits that user's write permission, so clients need no AWS
  credentials. With long-lived IAM-user keys, presigned URLs can live up to **7 days**.
- **Custom domain** — to serve from e.g. `cdn.yourdomain.com`: add an ACM cert (in
  `us-east-1`), set the distribution **Alternate domain name (CNAME)**, and add a DNS CNAME.
- **Prefer a role over the user** if the writer app ever moves onto AWS compute (EC2/ECS/
  Lambda) — drop the static keys and change the bucket policy `Principal` to the role ARN.

## Caching note

CloudFront caches objects, so overwritten objects won't update instantly. Either version the
object keys (e.g. `asset.v2.png`) or issue a CloudFront invalidation on overwrite.
