# Wix media IDs — 2026-10-15

2026-10-21 19:11 IDT recheck: still no upload. The user named `WIX_MEDIA_API_KEY`, but this running agent does not have it. `CLOUD_AGENT_ALL_SECRET_NAMES` and `CLOUD_AGENT_INJECTED_SECRET_NAMES` are only `WIX_FORMS_API_KEY`. No publish, no wix release, no merge. G8-T26 and G9-T32 were not touched. Kimi Code: do not open draft PRs from this rerun.

## Site IDs (checked 2026-10-21, before any upload call)

Both `df6b8141-b7d5-4d8b-8ba5-e382f5ebfd46` and `36dd9544-acf9-4e85-a01a-798f3c1efbb9` are meta site IDs. They are two Wix sites, not “site id vs meta site id”.

- Live `www.noamdoronmath.co.il` sets `getMetaSiteId()` to `df6b8141-b7d5-4d8b-8ba5-e382f5ebfd46`. That is the Headless project in `headless/astro-poc/wix.config.json`. The same page sets `getHtmlSiteId()` to the literal `dummy-site-id` and `isWixSite()` to false. This matches Noam’s memory for the live domain.
- `36dd9544-acf9-4e85-a01a-798f3c1efbb9` is the classic Studio meta site (contact form, legal iframe, `d8e7ad` files). It is not in the live homepage HTML. The 15.10 file URLs below use this host.
- `0ca81118-7ca8-40a7-8f97-8d06d901a556` is the Studio HTML app id, not a meta site. Media API returns HTTP 404 for it.
- A known student PDF returns HTTP 200 from both `*.usrfiles.com` hosts, from `static.wixstatic.com`, and from `www.noamdoronmath.co.il/_files/ugd/…`. The host does not show which library owns the file.

The Media Manager call was not made. The key has to be injected as `WIX_MEDIA_API_KEY`, scoped to the meta site that should receive the files.

2026-10-19 rerun: no upload. `WIX_MEDIA_API_KEY` was not injected then either.

## Site ID (checked 2026-10-19, before any upload)

- Live `www.noamdoronmath.co.il` sets `getMetaSiteId()` to `df6b8141-b7d5-4d8b-8ba5-e382f5ebfd46`. That same value is the Headless project `siteId` in `headless/astro-poc/wix.config.json`. On the live site, this is the meta site id.
- `36dd9544-acf9-4e85-a01a-798f3c1efbb9` is the Studio meta site id (contact form). It is not in the live homepage HTML. The 15.10 table below was checked against that Studio host.
- `0ca81118-7ca8-40a7-8f97-8d06d901a556` is the Studio HTML app id, not a meta site. Media API returns HTTP 404.
- Forms-key probe of `POST /site-media/v1/files/generate-upload-url`: `df6b8141` and `36dd9544` both return 403 `PERMISSION_DENIED` (valid site context, no media permission). `0ca81118` returns 404.
- `*.usrfiles.com` does not identify the owner: a zero UUID host still serves `d8e7ad_…`.

The 15.10 rows below are the earlier remote sha256 check. This rerun did not upload them again.

## 15.10 check

24 student pages were already in the Studio media library and READY. That run re-downloaded every file and matched sha256. No second upload. No publish, no wix release, no merge.

## This run

`WIX_MEDIA_API_KEY` is not injected into this agent. `CLOUD_AGENT_ALL_SECRET_NAMES` is still only `WIX_FORMS_API_KEY`. A new Media Manager call was not made. sha256 below is this run's re-download of the files already stored on the production meta site, compared with the approved student hashes in the handoff.

| package | level | filename | sha256 verified | Wix media ID | file URL |
| --- | --- | --- | --- | --- | --- |
| G7-T28 | r1 | `d8e7ad_acc48b0e3dfa415381e971c0ed2042f9.pdf` | yes `9a3d6d970fe1ae1c2d8ec27a8fe03f651db07b993edf7e065a0636b6136a0ab4` | `d8e7ad_acc48b0e3dfa415381e971c0ed2042f9.pdf` | https://36dd9544-acf9-4e85-a01a-798f3c1efbb9.usrfiles.com/ugd/d8e7ad_acc48b0e3dfa415381e971c0ed2042f9.pdf |
| G7-T28 | r2 | `d8e7ad_6b032e6166b14ac9a13e955fefc1b108.pdf` | yes `087c4b3df71cf2b97504cbc9718b93971538f3f2b806817294fd0ee4f5a3fc4b` | `d8e7ad_6b032e6166b14ac9a13e955fefc1b108.pdf` | https://36dd9544-acf9-4e85-a01a-798f3c1efbb9.usrfiles.com/ugd/d8e7ad_6b032e6166b14ac9a13e955fefc1b108.pdf |
| G7-T28 | r3 | `d8e7ad_f060bcf348814a2ea15de3da4a4ca78b.pdf` | yes `0dd68690e3fe700b90d45e164f7f9dc3ac16e55567bc9bcc53a0a066909a43c9` | `d8e7ad_f060bcf348814a2ea15de3da4a4ca78b.pdf` | https://36dd9544-acf9-4e85-a01a-798f3c1efbb9.usrfiles.com/ugd/d8e7ad_f060bcf348814a2ea15de3da4a4ca78b.pdf |
| G7-T47 | r1 | `d8e7ad_8964a6f6949347ebb31486f0f9095d6b.pdf` | yes `5452c9a41c9070c3c805507396dfd46aa39a68060b42cbe9f4b4260f4b95a938` | `d8e7ad_8964a6f6949347ebb31486f0f9095d6b.pdf` | https://36dd9544-acf9-4e85-a01a-798f3c1efbb9.usrfiles.com/ugd/d8e7ad_8964a6f6949347ebb31486f0f9095d6b.pdf |
| G7-T47 | r2 | `d8e7ad_e26cceb713814ad2a0534c0b3f288e50.pdf` | yes `aef47e35d87105c65a78d7b7e27db1a8075a59a84e9f54a9714f0ed0e924aba2` | `d8e7ad_e26cceb713814ad2a0534c0b3f288e50.pdf` | https://36dd9544-acf9-4e85-a01a-798f3c1efbb9.usrfiles.com/ugd/d8e7ad_e26cceb713814ad2a0534c0b3f288e50.pdf |
| G7-T47 | r3 | `d8e7ad_ad202916bec84364928f8b0f49a40c46.pdf` | yes `9b7a4842a2a0e486faea9a9382ed14695e5fe056bf804140f919e2b3deb53f19` | `d8e7ad_ad202916bec84364928f8b0f49a40c46.pdf` | https://36dd9544-acf9-4e85-a01a-798f3c1efbb9.usrfiles.com/ugd/d8e7ad_ad202916bec84364928f8b0f49a40c46.pdf |
| G7-T48 | r1 | `d8e7ad_1a77a39260504461a59a8623f08e98c2.pdf` | yes `711da842c661a48202310d38f6ef5dcbf112e9ce8b59ba743b5deca03d2ece92` | `d8e7ad_1a77a39260504461a59a8623f08e98c2.pdf` | https://36dd9544-acf9-4e85-a01a-798f3c1efbb9.usrfiles.com/ugd/d8e7ad_1a77a39260504461a59a8623f08e98c2.pdf |
| G7-T48 | r2 | `d8e7ad_5610935afd5c46a6afe3db53d470ae27.pdf` | yes `0a0c043bc0b4dd5a2618a203f547195f9ea1aee3e11692c1e5a31c6614cd9fe6` | `d8e7ad_5610935afd5c46a6afe3db53d470ae27.pdf` | https://36dd9544-acf9-4e85-a01a-798f3c1efbb9.usrfiles.com/ugd/d8e7ad_5610935afd5c46a6afe3db53d470ae27.pdf |
| G7-T48 | r3 | `d8e7ad_9aa1f9bf967e483686c9e2258bd93fbe.pdf` | yes `4f33babe659d8fd705bbcc61cda40943a8e8305b6d4fad3736b33ccd0ad20e2a` | `d8e7ad_9aa1f9bf967e483686c9e2258bd93fbe.pdf` | https://36dd9544-acf9-4e85-a01a-798f3c1efbb9.usrfiles.com/ugd/d8e7ad_9aa1f9bf967e483686c9e2258bd93fbe.pdf |
| G8-T11 | r1 | `d8e7ad_eed0be25fbed462f82d36fb778cc6052.pdf` | yes `2becdb9a9c91b01607d673cab898fbfad01129a2abfe615dbaf29c9b03151d30` | `d8e7ad_eed0be25fbed462f82d36fb778cc6052.pdf` | https://36dd9544-acf9-4e85-a01a-798f3c1efbb9.usrfiles.com/ugd/d8e7ad_eed0be25fbed462f82d36fb778cc6052.pdf |
| G8-T11 | r2 | `d8e7ad_8454602274d04b5cb9c65c1098d42be0.pdf` | yes `f1f7810fda61b59b3ea6c66452465aa4a854ae92759d04b4b20a8d7742df68d9` | `d8e7ad_8454602274d04b5cb9c65c1098d42be0.pdf` | https://36dd9544-acf9-4e85-a01a-798f3c1efbb9.usrfiles.com/ugd/d8e7ad_8454602274d04b5cb9c65c1098d42be0.pdf |
| G8-T11 | r3 | `d8e7ad_ecfcbc8dbba543b5af7cef7c1bce8dba.pdf` | yes `2bca3ffb9ac2a34cd3d775d0f4c4ec83a7d3ff7471f679b96136da62bc2db02c` | `d8e7ad_ecfcbc8dbba543b5af7cef7c1bce8dba.pdf` | https://36dd9544-acf9-4e85-a01a-798f3c1efbb9.usrfiles.com/ugd/d8e7ad_ecfcbc8dbba543b5af7cef7c1bce8dba.pdf |
| G8-T29 | r1 | `d8e7ad_9443e3dab94241619cae5288372a588b.pdf` | yes `cb8af07a674ecfa27ac302d5a7a35e5c52f3f1919295ba38f2f111c0e3151b32` | `d8e7ad_9443e3dab94241619cae5288372a588b.pdf` | https://36dd9544-acf9-4e85-a01a-798f3c1efbb9.usrfiles.com/ugd/d8e7ad_9443e3dab94241619cae5288372a588b.pdf |
| G8-T29 | r2 | `d8e7ad_73750601a2a040d0bbb8710ec407397a.pdf` | yes `83cc63a442ee2dcbcaed950ef72473060bf0d1cf2077c96e967d44a56b4ad009` | `d8e7ad_73750601a2a040d0bbb8710ec407397a.pdf` | https://36dd9544-acf9-4e85-a01a-798f3c1efbb9.usrfiles.com/ugd/d8e7ad_73750601a2a040d0bbb8710ec407397a.pdf |
| G8-T29 | r3 | `d8e7ad_18cadcb111e84ed4805fc578631c3f2e.pdf` | yes `35290b9f7fbd941c3868ce71b04d525dd389f17b8eb4453114f344bfe83ef6ac` | `d8e7ad_18cadcb111e84ed4805fc578631c3f2e.pdf` | https://36dd9544-acf9-4e85-a01a-798f3c1efbb9.usrfiles.com/ugd/d8e7ad_18cadcb111e84ed4805fc578631c3f2e.pdf |
| G8-T37 | r1 | `d8e7ad_d0e31c3c5aa4445c9f0235bae58fed5a.pdf` | yes `5635123158475e7e11e3212550f53155586e83dda40349085140931c5d9810b7` | `d8e7ad_d0e31c3c5aa4445c9f0235bae58fed5a.pdf` | https://36dd9544-acf9-4e85-a01a-798f3c1efbb9.usrfiles.com/ugd/d8e7ad_d0e31c3c5aa4445c9f0235bae58fed5a.pdf |
| G8-T37 | r2 | `d8e7ad_76714c3d36374203999db4ceab111358.pdf` | yes `66a0317ebec72b27ba6b8a8e052d3d61de354f137f34989fe7666d66dca9b898` | `d8e7ad_76714c3d36374203999db4ceab111358.pdf` | https://36dd9544-acf9-4e85-a01a-798f3c1efbb9.usrfiles.com/ugd/d8e7ad_76714c3d36374203999db4ceab111358.pdf |
| G8-T37 | r3 | `d8e7ad_98f4516c1e9e4c52ada734e31df2edc6.pdf` | yes `d52fb9fa0c4eb60d32056ac47c4bc0ae797c3b0521ecb47ff4be86fab5e91f85` | `d8e7ad_98f4516c1e9e4c52ada734e31df2edc6.pdf` | https://36dd9544-acf9-4e85-a01a-798f3c1efbb9.usrfiles.com/ugd/d8e7ad_98f4516c1e9e4c52ada734e31df2edc6.pdf |
| G8-T49 | r1 | `d8e7ad_54957bc52e6f43c7b54f954f591d488c.pdf` | yes `0704e50fbf783e872cde899ea060ffcb1e0702c221cbeb478261196ed316a97b` | `d8e7ad_54957bc52e6f43c7b54f954f591d488c.pdf` | https://36dd9544-acf9-4e85-a01a-798f3c1efbb9.usrfiles.com/ugd/d8e7ad_54957bc52e6f43c7b54f954f591d488c.pdf |
| G8-T49 | r2 | `d8e7ad_61ea19bb43374124afd484642058d5c9.pdf` | yes `3f5687008b4fe6a2f86c7ff9139b612f82aa005e9f09aa5e7bbad27f1d15341b` | `d8e7ad_61ea19bb43374124afd484642058d5c9.pdf` | https://36dd9544-acf9-4e85-a01a-798f3c1efbb9.usrfiles.com/ugd/d8e7ad_61ea19bb43374124afd484642058d5c9.pdf |
| G8-T49 | r3 | `d8e7ad_bf7299b4a76b4b7986732cd0fa2d4cc0.pdf` | yes `0cfaa01bfeab828b97086fe2e0e2ace39f0039892978276d581a6cce13845541` | `d8e7ad_bf7299b4a76b4b7986732cd0fa2d4cc0.pdf` | https://36dd9544-acf9-4e85-a01a-798f3c1efbb9.usrfiles.com/ugd/d8e7ad_bf7299b4a76b4b7986732cd0fa2d4cc0.pdf |
| G9-T17 | r1 | `d8e7ad_975c532d265d4b90b536bbb247817f38.pdf` | yes `c33450ece0fb4562998eadb5200a0d923510ef78e77fe8250aecb7d5116a0eb2` | `d8e7ad_975c532d265d4b90b536bbb247817f38.pdf` | https://36dd9544-acf9-4e85-a01a-798f3c1efbb9.usrfiles.com/ugd/d8e7ad_975c532d265d4b90b536bbb247817f38.pdf |
| G9-T17 | r2 | `d8e7ad_b38c199bb4bf4c828a23c4c3f25ac3da.pdf` | yes `c3af8e51572474639141c99affc4f173f32b1a0f7f46fb5b3623ab848d90bb15` | `d8e7ad_b38c199bb4bf4c828a23c4c3f25ac3da.pdf` | https://36dd9544-acf9-4e85-a01a-798f3c1efbb9.usrfiles.com/ugd/d8e7ad_b38c199bb4bf4c828a23c4c3f25ac3da.pdf |
| G9-T17 | r3 | `d8e7ad_11c7f97008dc4d8c95c46dfc04f47eeb.pdf` | yes `5422705880099d510ecba50c4fc1dae93f21fc6f55416a9f01bee4a85e97f3e8` | `d8e7ad_11c7f97008dc4d8c95c46dfc04f47eeb.pdf` | https://36dd9544-acf9-4e85-a01a-798f3c1efbb9.usrfiles.com/ugd/d8e7ad_11c7f97008dc4d8c95c46dfc04f47eeb.pdf |

Kimi Code: the 2026-10-21 19:11 IDT recheck did not upload. `WIX_MEDIA_API_KEY` is still not in this agent. Do not open draft PRs from this rerun. G8-T26 and G9-T32 stay untouched.
