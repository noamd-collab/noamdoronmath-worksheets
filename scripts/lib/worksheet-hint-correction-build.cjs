// Build-only fixed proof: never import this module into the SSR graph.
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { hintCorrectionScope } = require('./worksheet-hint-correction.mjs');
const ROWS = [
  {
    "editionId": "ms-20261113-par-r1",
    "exerciseId": "G9-T85-A-Q06ב",
    "canonicalItemId": "ms-g9-par-01-a-r1.question.06.item.02",
    "sourceBindingSha256": "2bddb68785e558979949b99a3c2a17d6cc3c24f23a3662d33761f1ff94cda002",
    "beforeHintSha256": [
      "425fb9a3b901dfe6e91ce91f60194080569e43749d54f98d080d16a90435da6c",
      "004f1d1f233e70eca0a4cbd29551fc4cdc7ecdeee18d33ba5ee52d39ac76059b",
      "0c165bcf50eb49c36f1cc4ea3b8a889561934ced96fa4da994b861778c60f325"
    ],
    "afterHintSha256": [
      "fb949635a0e5d0e9fee1be171ad4f15e04b4981f4d8e288815322eeffa480917",
      "bc2ee1c53aa15a24e475074861e277ab6e311ec3976603052e35d05e3e1e0565",
      "3e0f16c8eeb4fbc5974d304efb7bd6c3a44cc93a6b6abcbe43165511e70108e3"
    ]
  },
  {
    "editionId": "ms-20261113-par-r1",
    "exerciseId": "G9-T85-B-Q07ג",
    "canonicalItemId": "ms-g9-par-01-b-r1.question.07.item.03",
    "sourceBindingSha256": "8db77682d4780e72fbd5df7a8a8370f2a99ed73ad299b5dca2580ebad660b324",
    "beforeHintSha256": [
      "65c05b7840591918e57aebff8328c3fa9a5cbc7e1f72bf3380509f8837b3ce2d",
      "41e48faa154009a93e16a15cfcce0e68f79a227015bc8c71afed1b0104dcd73a",
      "1bae17f31ed600b16efdd4971258d5d98b281950084c6425f0bbd47f2a0f4bb2"
    ],
    "afterHintSha256": [
      "24c2273100bc28d023e8244fedc5f5af7a2a77332eb4c79ba4e78997ff7b181d",
      "fdb52632927f21e0bc260589112e6a0fc2e24a6fc3f453fd5267b56d92d599fc",
      "37926652ae78635cca9c513e02172e7f0ad503f1aa601b526faf3dec1c39273c"
    ]
  },
  {
    "editionId": "ms-20261113-par-r1",
    "exerciseId": "G9-T85-B-Q12ב",
    "canonicalItemId": "ms-g9-par-01-b-r1.question.12.item.02",
    "sourceBindingSha256": "5bf7b4273a160ccd2eee55c16806cf8140b22bbd8ab59823a533642f6a3dbe45",
    "beforeHintSha256": [
      "cb7e33a0167588a4661a862a1fc1119b9d12c4c20d30124f4e6b5b0ab38fdd67",
      "321a9f01467bc547f72e0f78f627d946f6407847e86a9a0844953eb538b35456",
      "c4255c6fd7268f9de455f096e349b872c845baf1dee15d7d1e3b28b8bec23e13"
    ],
    "afterHintSha256": [
      "5a47a53ef1413ffb3b518408a9a23d3db0ec024955c57b567390db80b194c8ff",
      "4cb3bdce8a8d977fdb6853f212fddec2d3c2698bd964f87e1bf6f6ddc179283b",
      "e6ef325fe15bab2180acda357ecd83a3c7a3e53e452c3cefdc5a2e424a679c3c"
    ]
  },
  {
    "editionId": "ms-20261113-par-r1",
    "exerciseId": "G9-T85-B-Q12ג",
    "canonicalItemId": "ms-g9-par-01-b-r1.question.12.item.03",
    "sourceBindingSha256": "8a6374da58e21664f19cd061f7d845447a24e84884aec0687821cf0baada3881",
    "beforeHintSha256": [
      "7232f7c476013acc4dc7a93ddf12fdfeb56de046dd27a0070f66bba10066e959",
      "7b5e32330efad74ac996668ad495bf483141be012d06b0a0c6a9ee7e9943abe3",
      "34a3d51b86c432ab60eadd70c928d7ccaf2e3e48bcd847838c4af8defb9154d7"
    ],
    "afterHintSha256": [
      "aecb86aa41ff2e4ae7d13d8c2596328b150e2dbccf03d8a5229b48eca2896935",
      "36466082d230b4741d7a2531e196a8dc03472a75f6aeb0c531b1ebf8ec8b3e0c",
      "8101d4dcf2a724dac29193d2d387d3aa666100f49563310859942f267a790162"
    ]
  },
  {
    "editionId": "ms-20261113-par-r1",
    "exerciseId": "G9-T85-E-Q02ב",
    "canonicalItemId": "ms-g9-par-01-c-r1.question.02.item.02",
    "sourceBindingSha256": "6d85a011784a65c2867053a748f94c9c1600eca4656661e5a208c9e2f5642877",
    "beforeHintSha256": [
      "3ea3daca3770afebf33c3f92537f2fd126ddc3b6c2dfd311e79f434a9ca90dcb",
      "27e494c6051b86bcc23156bc83c82f682d9a5d4f1efed2d043fc90cf14f356d9",
      "9a1f030d82407fd9018300b38d54c8c1ccc126caff7bb20afc85e245cb717c5b"
    ],
    "afterHintSha256": [
      "cec46a3989f64d27f9d211971b5bc12d857f40c6fe2fa7c2f4c912aa0c62d085",
      "643d15186179938ca885d07b847b85277c867ca27fdcd6f2513d317e715f4d52",
      "f4204997a6da2350b3cb21378ef1a2a8ab402e00b031f38981adc47a92dbad14"
    ]
  },
  {
    "editionId": "ms-20261113-par-r1",
    "exerciseId": "G9-T85-E-Q02ד",
    "canonicalItemId": "ms-g9-par-01-c-r1.question.02.item.04",
    "sourceBindingSha256": "4c175d8bd7ddee3f5d8711e8cde756f2303fd374af8311998e92cd8f09264810",
    "beforeHintSha256": [
      "5fe36dc6693b91d70b11d38c80efe1999fcddbf776903e49110f031ed4f5651c",
      "300f3866715f8e75fd28dbf35a2da20f2b7fc880b5b758c6861a6547eda5d13d",
      "749f4b85480cf14b84be2ad84ab5e175f4986ce1c073d4f210c6990e292207d7"
    ],
    "afterHintSha256": [
      "31aa37992c58a7a4577b844a1508af39648321527c66ba264e3d76666883e10e",
      "1085c8a1701943150b1d804e4762145d58e3efd72b3532a83a129ef130084947",
      "30807d5144b782686ddc13aecd5c1c3900d7bde9a9033ee153a9c70f01d493f9"
    ]
  },
  {
    "editionId": "ms-20261113-par-r1",
    "exerciseId": "G9-T85-E-Q03א",
    "canonicalItemId": "ms-g9-par-01-c-r1.question.03.item.01",
    "sourceBindingSha256": "22698efdf855cf9ccd0e0e907252e93b7042d0e2720bcf40ec08464933461bc2",
    "beforeHintSha256": [
      "fefa1874bf900018e0a1dbc64d0c92b4d8fcae1f5f1378f52a7e97e73fa925a5",
      "ef70249abb04f92a0eeabf8ecd6c7890451d63b38a6245f32089e7cb9726e7f2",
      "679a0f36f99c4e85a0fe6afe7b5f9799984d35ee4a0825986844d1f93ed70361"
    ],
    "afterHintSha256": [
      "321b8bbce663e1cfaabcc6546e7ce482b864ed7f4601173b1f88729789f79e1f",
      "0dc9b462751c6591b7bb0e8e4bf66a32dade40beebdca28317e3c0631b5bd4ce",
      "5005ce0fff85f2dde3f65d66cfb59200098849c4fb5dbaff82db800b548473f4"
    ]
  },
  {
    "editionId": "ms-20261113-par-r1",
    "exerciseId": "G9-T85-E-Q07ב",
    "canonicalItemId": "ms-g9-par-01-c-r1.question.07.item.02",
    "sourceBindingSha256": "25436ce3edb4a1ae6fb6fad788c94f9f765d25e4cbe83dc91bc5a356c9373d28",
    "beforeHintSha256": [
      "dd50d2937ff8d17369cb8149058d6cbe8778ce60035c5a5b0a17db2ca14f17a1",
      "c4a35999def341caf49f108cff7b1ddcb0e0fb6b018a5180c690270fac58c828",
      "cdf9c1c3d10af169e7d472fa33e5811b39c85e0eee56086735016c50cdee9ad7"
    ],
    "afterHintSha256": [
      "5073bad89440edd11a4da8a17127a77fb481b5f158c0a7f9f5ee0f9daae57e17",
      "809e9d542edbc5eb1f784660e0f76700c1444f100d426846a05cbbbcb0b189e5",
      "48fc0ff2e7c72cf2f6e596abf63a8d22c4e996f73f35b1ce43dac39ce03f9f3f"
    ]
  },
  {
    "editionId": "ms-20261113-par-r1",
    "exerciseId": "G9-T85-E-Q07ג",
    "canonicalItemId": "ms-g9-par-01-c-r1.question.07.item.03",
    "sourceBindingSha256": "c69640ba8e4373f085cc5c3b8cbf509c9dff71b54a6e27aa44d6bae73356049d",
    "beforeHintSha256": [
      "1c6a6272365e52fc88b1828379b7c0df5c5277b68b45ee14ea30111aa792723a",
      "33908cb50b69464d32bb1e38ab175491c51cf341a7ccdca0d5d52842f66a37ea",
      "975ceee38d1e76e1168e4e3cf5a75dd468bbcf3cebf4757b8868d1bf94f0c07c"
    ],
    "afterHintSha256": [
      "bec2cc2769111ce6ef645ca2dcb6774fe3d42a8730d3b47d5fc5ce40d6b335c9",
      "c00a24e6b9cf6ce6a055f3e1616ffeef245856f7c4dec0ba196bdf7271167607",
      "553fa804fcc8e934b209e03a09672c4ec96c442306b2bb371d9c5971e9799188"
    ]
  },
  {
    "editionId": "ms-20261113-par-r1",
    "exerciseId": "G9-T85-E-Q09א",
    "canonicalItemId": "ms-g9-par-01-c-r1.question.09.item.01",
    "sourceBindingSha256": "2e5ef8e7564151e922adb086a6627d613ebd676d6bc4a38acee3d03d84295773",
    "beforeHintSha256": [
      "7a91f07fbe6e68416e05d1365e2df31860a6cbee6844cb75fd9a2d87139d4961",
      "6fbf9a8865d34506d1c3e1300f14a6cedb867bc330f1fdc128ec3d2ed1e19b87",
      "fbe65fe44af29261551a76f427f65f85797c0e162dd1ef41c66dcf12c46fc964"
    ],
    "afterHintSha256": [
      "b7f4e579e54522a73cae59cd395106c14796c388de113ac9e8e6970da96939f4",
      "ffcea37139422d323be4ab14fd1cfa145e19085907670e465b4d5468bbc1222c",
      "80d20e6c144870f178336b05eddd345eb9fdf46de65937f23df4fa1e67c31e96"
    ]
  },
  {
    "editionId": "ms-20261113-par-r1",
    "exerciseId": "G9-T85-E-Q09ב",
    "canonicalItemId": "ms-g9-par-01-c-r1.question.09.item.02",
    "sourceBindingSha256": "96d83739c278bedbc4f9f0ff9584bf3cd2b5e43395a49c127d4507d359dcffa9",
    "beforeHintSha256": [
      "2d17fd4697009b768b6af3f33fe1a0a18537eae363b612fbc066d59609f4ef7c",
      "b91bb1632c55074e59239073b7ec92ecfc41b2621316a8240cd813e8ed9c2601",
      "3d354eff3cbdf53885419ebd0a81262aa3d93396ceed4f2791f5735a9956d157"
    ],
    "afterHintSha256": [
      "c308b3c6138b42eeb33d19d181bf447022e183ebe5ec6f33b2e48853460009a6",
      "32422e9d74eec18383a0480dde88ccbaacae30e33d562dc54988dde0afe01390",
      "5b8ff1c46d20b782fb45054a5d5632ee56cb8cda02297978cbdfe6a15456ab0f"
    ]
  },
  {
    "editionId": "ms-20261113-par-r1",
    "exerciseId": "G9-T85-E-Q12ב",
    "canonicalItemId": "ms-g9-par-01-c-r1.question.12.item.02",
    "sourceBindingSha256": "990986822583bd8571aecc0f85b5f90ef0293a4ffef74129642476488262fbb8",
    "beforeHintSha256": [
      "ed850281c90b5524cc3fca20361f4e7d4e650fd100d862892e88378c769c793d",
      "eb5b50f9408f994477833e24ebfe2eaf1822e8d0504c0de450b71d1a4a2d17ea",
      "ed1abfa1902b0a7af1000d72a0ce06295fce244bed27bc925234aff6cf32f0a2"
    ],
    "afterHintSha256": [
      "8d293f3636be685ae13e53e25337c15971b625aeb0c919b03f810592caa7dd1e",
      "8dfdf5288145e221304b69738623bb768a3b2bf77cf4a8c380d538cae6b4e082",
      "380e6189c265fe9e784295cc1498c60c52d166f1e15d26dc2c69b6e520305680"
    ]
  },
  {
    "editionId": "ms-20261113-trn-r1",
    "exerciseId": "G7-T86-B-Q05א",
    "canonicalItemId": "ms-g7-trn-01-b-r1.question.05.item.01",
    "sourceBindingSha256": "03111968fcd92b1767704408c12380c55a87f15bc645a62f201f47bcc6c20906",
    "beforeHintSha256": [
      "0f8453c92330f906c6ffd8ca7bc496e2cf5c89d2b82861a0b065fbb2f84ed02e",
      "aa0d6ab9906f2c280ca065d3e5c6abd0e72079ee7262d095ddbf86d6bcbe14a0",
      "aea8cac9cb274481078511e7210f8f02fe4f0b3f93fa98bc0c118eca7051a3e6"
    ],
    "afterHintSha256": [
      "21494a1facf83abf1a7d2c41b0dbecd1c8b7c740752f82acb94cdb897c6e45bd",
      "dfc6926c851c3d71648abb045ef284e40600d6098b1a9a541a5f694ea2ab9381",
      "4d739b25304e3d1af4fc7d40e5c7ce4fc17a13ca864f92d0901851381be1474c"
    ]
  },
  {
    "editionId": "ms-20261113-cyl-r1",
    "exerciseId": "G8-T84-E-Q11ה",
    "canonicalItemId": "ms-g8-cyl-01-c-r1.question.11.item.05",
    "sourceBindingSha256": "8fcf2394aa94f6fc5077ffde38a4e070e3cff09dc32168afa1cd56ba238fe717",
    "beforeHintSha256": [
      "1ae65c9b10ffd3fa9f2a71ca08bc78430e6a48c43e49f65764d5b36b363c457f",
      "7b33970cc95a6dc4a40dcca6b1485732a7219aa4e6df00280612a90556818f21",
      "953849a8ee9b14cb45466df09f687f81b8c3f511f2b5b8e13e0486316ad7ad11"
    ],
    "afterHintSha256": [
      "edcf7ca8daaaaf0b01d2857bb59ded1706122bb70f52721857ece3455d2fc3eb",
      "ccbf96e17a67311224c443e0320bb76d43bb1274ac93441cd6370df0d9591a4c",
      "13812a4844c5f22d634ad4042598d13f6fcd98eb4fddc42d269abb447bbe5fd2"
    ]
  },
  {
    "editionId": "ms-20261113-cyl-r1",
    "exerciseId": "G8-T84-E-Q01ד",
    "canonicalItemId": "ms-g8-cyl-01-c-r1.question.01.item.04",
    "sourceBindingSha256": "94a21515ed296d51951fb7d04ccb9f8f10baa651a953a083c19f1c7ad073f1e5",
    "beforeHintSha256": [
      "b944eeefc5895faba1633e6cf9df34d41d139b2f5d2bacef3e185e7deba9af5c",
      "26d0f1e98e2cb7a929e016d6cec4d8a26c932da1cb08dc2bfae497f8c6529268",
      "88ed394ecd2e67848d28391f7bd3046f91f93bc812f3923234ebb0e935fc308b"
    ],
    "afterHintSha256": [
      "7bbaa62025004073dafe1e46642b0eb82dfe454260639d6072ddfe28bedbe7a8",
      "700aed3a120006e11b2d673a97e29ad7e4d58ba9f2c95bbe3da02f9802b35a39",
      "2582122581db3283a249cb1c2db7ea3abe9a028384073433ca6f5e5b4f0dea6e"
    ]
  }
];
const SOURCE_BINDING_FIELDS = Object.freeze(["edition_id", "exercise_id", "source_pdf_hash", "source_pdf_sha256", "canonical_source_sha256", "canonical_question_sha256", "canonical_item_id", "source_exercise_sha256"]);

function hintCorrectionBuildScope() { return { ...hintCorrectionScope(), rows: JSON.parse(JSON.stringify(ROWS)) }; }
function validateHintCorrectionRows(raw) {
  if (!(typeof raw === 'string' || Buffer.isBuffer(raw))) throw Error('Hint correction: full row proof bytes absent');
  const expected = hintCorrectionScope().rowScope;
  if (crypto.createHash('sha256').update(raw).digest('hex') !== expected.rowScopeSha256)
    throw Error('Hint correction: full row proof hash mismatch');
  const rows = JSON.parse(String(raw));
  try { assert.deepStrictEqual(rows, ROWS); }
  catch { throw Error('Hint correction: exact 15 rows/source/before/after proof required'); }
  return rows;
}
module.exports = { hintCorrectionBuildScope, validateHintCorrectionRows, SOURCE_BINDING_FIELDS };
