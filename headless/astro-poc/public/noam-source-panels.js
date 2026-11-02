(function (root, factory) {
  "use strict";
  var api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.NoamSourcePanels = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";
  // Reviewed printed question panels. Numeric suffixes identify exports only:
  // they never imply left/right, a person's name, a stage, or the correct answer.
  var REVIEWED = {
  "G7-T01/c/q31": 2,
  "G7-T01/c/q39": 2,
  "G7-T22/a/q21": 3,
  "G7-T22/a/q22": 3,
  "G7-T22/b/q21": 3,
  "G7-T22/b/q22": 3,
  "G7-T22/c/q21": 3,
  "G7-T24/c/q15": 2,
  "G8-T12/a/q12": 2,
  "G8-T12/b/q13": 2,
  "G8-T12/c/q19": 2,
  "G8-T14/c/q4": 2,
  "G8-T14/c/q12": 2,
  "G8-T17/a/q9": 2,
  "G8-T17/b/q5": 2,
  "G8-T17/c/q10": 2,
  "G8-T29/a/q8": 2,
  "G8-T29/b/q10": 2,
  "G8-T29/c/q6": 2,
  "G8-T29/c/q15": 2,
  "G8-T52/c/q19": 2,
  "G8-T54/a/q10": 2,
  "G8-T54/a/q17": 2,
  "G8-T54/b/q9": 2,
  "G8-T54/b/q20": 2,
  "G8-T54/c/q3": 2,
  "G8-T54/c/q12": 2,
  "G8-T54/c/q19": 2,
  "G8-TWOSRC/a/q3": 2,
  "G8-TWOSRC/a/q6": 2,
  "G8-TWOSRC/a/q7": 2,
  "G8-TWOSRC/a/q10": 2,
  "G8-TWOSRC/a/q13": 2,
  "G8-TWOSRC/a/q14": 2,
  "G8-TWOSRC/b/q2": 2,
  "G8-TWOSRC/b/q4": 2,
  "G8-TWOSRC/b/q6": 2,
  "G8-TWOSRC/b/q10": 2,
  "G8-TWOSRC/b/q12": 2,
  "G8-TWOSRC/b/q13": 2,
  "G8-TWOSRC/c/q3": 2,
  "G8-TWOSRC/c/q6": 2,
  "G8-TWOSRC/c/q8": 2,
  "G8-TWOSRC/c/q12": 2,
  "G8-TWOSRC/c/q13": 2,
  "G8-TWOSRC/c/q14": 2,
  "G9-T12/a/q3": 3,
  "G9-T12/b/q27": 3,
  "G9-T13/a/q17": 2,
  "G7-T24/a/q20": 2,
  "G8-T29/c/q20": 2,
  "G8-T35/a/q7": 2
};
  // Exact PDF crop-fidelity reviews, 2026-10-28; not a general reviewRequired override.
  // Approval ledger SHA256: 64f14d47c3a5de920c1fcd31d587026049fcf11931e1c2ae8929cf6d20604c00
  // Fields: PDF identity, source/native hashes, actual PDF pages, [page,x,y,w,h].
  var APPROVED_CROPS = {
    "G7-T01/c/q31": {"pdf":"9348a859e460426baaaa17ff03858f06","source":"025c6e1a5afd311737eafb2969915b48843355683396aff7e6a7c3edff13c72a","native":"fdcf420bbfb6326fce11d674c17232f19b9f6a68fce0bc5311d3893529bf3105","pages":19,"crops":[[14,0,0.711836,1,0.140769],[15,0,0.053575,1,0.220351]]},
    "G7-T01/c/q39": {"pdf":"9348a859e460426baaaa17ff03858f06","source":"025c6e1a5afd311737eafb2969915b48843355683396aff7e6a7c3edff13c72a","native":"fdcf420bbfb6326fce11d674c17232f19b9f6a68fce0bc5311d3893529bf3105","pages":19,"crops":[[18,0,0.058141,1,0.362902]]},
    "G7-T22/a/q21": {"pdf":"8474535578894a669c6847e57a83dc30","source":"1fe136d605336f197c7dc4033fc55c4bacac65ee8633b349bea1ab18c47ca86a","native":"65fc10803880c36c80172ae170e0bcbbe3d69a93674f8cfa7f8b2602241d4881","pages":12,"crops":[[11,0,0.602224,1,0.305801],[12,0,0.053575,1,0.082416]]},
    "G7-T22/a/q22": {"pdf":"8474535578894a669c6847e57a83dc30","source":"1fe136d605336f197c7dc4033fc55c4bacac65ee8633b349bea1ab18c47ca86a","native":"65fc10803880c36c80172ae170e0bcbbe3d69a93674f8cfa7f8b2602241d4881","pages":12,"crops":[[12,0,0.135992,1,0.455596]]},
    "G7-T22/b/q21": {"pdf":"1ea1c578cd2b4ec3b2813c6d9462f15d","source":"071998ec84950585d7b9a29c39bcc561c782f3cc07dc941043f33575fadd09a3","native":"acc34db31c0e35fcce5d432360198a3f6ff37182a83b8715ddbf6a31c1fa9fe4","pages":11,"crops":[[10,0,0.10045,1,0.361491]]},
    "G7-T22/b/q22": {"pdf":"1ea1c578cd2b4ec3b2813c6d9462f15d","source":"071998ec84950585d7b9a29c39bcc561c782f3cc07dc941043f33575fadd09a3","native":"acc34db31c0e35fcce5d432360198a3f6ff37182a83b8715ddbf6a31c1fa9fe4","pages":11,"crops":[[10,0,0.461942,1,0.486002],[11,0,0.053575,1,0.165583]]},
    "G7-T22/c/q21": {"pdf":"6af3ca30eacf4b0cbded99226c8f159a","source":"341a10c416be282f26a666beaa55bd17aaa8cbda4b4ec12e5bcd6f582e7e92bf","native":"ac614606623f6e950c311d8a75de57c45934538b5f0bd1d3355ba685ace51912","pages":13,"crops":[[13,0,0.10045,1,0.559134]]},
    "G7-T24/a/q20": {"pdf":"5a67514458aa434a9cbdf82ff70b5fd0","source":"7f3bdbb69b9f9c107a0beb21bb446a431b11760ef09c555c0de6cf36524a49cc","native":"33d0e844833cfb3a719089b237eb03684bd4d5418b910c47ed1a6af3bb760d05","pages":15,"crops":[[15,0,0.271551,1,0.666151]]},
    "G7-T24/c/q15": {"pdf":"ec402adea9f04b6a983200e77a0bf7a8","source":"00306060fa24052da9ba6b62c407e0320193c0f21e204a939dc651b63ed0a245","native":"d5bb2288439ff83011700baf5e40dd4a9f14c6f01aa9f3a12c8fc14f649198e2","pages":14,"crops":[[11,0,0.058141,1,0.675723]]},
    "G8-T12/a/q12": {"pdf":"d06d607e935d446e9cc759f6b717e46d","source":"a357d196c4dcca9878e0c866241032ccab7949a71457939061a49e095cd0495e","native":"6ce72f60134b8eecffcb9b28000f5c63b0bf2716520a390283894b0a9ec612cc","pages":18,"crops":[[10,0,0.483251,1,0.405503],[11,0,0.053575,1,0.134186]]},
    "G8-T12/b/q13": {"pdf":"d7eaeb9328c44b029e283beb206d3c67","source":"d1c9c0224f34a385d9ab3d91c9988caa39bda20071f871de858c40cdf6d61d4c","native":"f41a3defd501608d36f6add167291cd4eed27ac8b50a9136640622dc1982de24","pages":17,"crops":[[12,0,0.058141,1,0.574857]]},
    "G8-T12/c/q19": {"pdf":"66a2c1bad7e140b3b58d4135ab51dc1e","source":"4e6d1a7980fa74983608bf73001bbbf85c925bb2d5cee9738c854df9178a9566","native":"ed3cf91c7f28921fd8006ca93c626582da78f4256be68f07a2b71690521db55c","pages":19,"crops":[[17,0,0.058141,1,0.633878]]},
    "G8-T14/c/q12": {"pdf":"fa0edb4749d449ac8c80a57a2230c4a7","source":"d215cc53ee92d4402b23228aaeea38af81209d0b9a6de663d83b0eb0a0fe4ef3","native":"d9b1812c17cbacde2d6d2e2748e5252df775b6e8a11add3b40450fc84a8954c0","pages":20,"crops":[[12,0,0.058141,1,0.576722]]},
    "G8-T14/c/q4": {"pdf":"fa0edb4749d449ac8c80a57a2230c4a7","source":"d215cc53ee92d4402b23228aaeea38af81209d0b9a6de663d83b0eb0a0fe4ef3","native":"d9b1812c17cbacde2d6d2e2748e5252df775b6e8a11add3b40450fc84a8954c0","pages":20,"crops":[[4,0,0.058141,1,0.563965]]},
    "G8-T17/a/q9": {"pdf":"b1216b68cee04448a7a4d0760d14e085","source":"8bee1c27eea34244bb28a3d9b9df8718e337b3c38a6b13e93d3b632561ff45da","native":"80bf8ace5ad9dac43e2303d97555b261c93a5eb7815f53ef13f4b85822448d7b","pages":24,"crops":[[10,0,0.33302,1,0.591969]]},
    "G8-T17/b/q5": {"pdf":"22623c3ff0b94e36b61b23d7677c0432","source":"71e5c73a6385f86f4167e003ef004394d400a20fabb71041ba0c538181de7170","native":"fbe58330a0a451286293d4af7e3fd1b29fdef34af22fb5fc6e5722a8cdeab548","pages":20,"crops":[[5,0,0.226908,1,0.67562]]},
    "G8-T17/c/q10": {"pdf":"6d3cbf3ec35b4a8a866d4d536a5963af","source":"9f02ef48b0624d7322959173493d255d29d5c2c48dd0ad00ca8c6e66bd35b5d0","native":"5c4d82a6f5e8875a650cff4e820be533b471204818f6bfa882fe468dac25fb43","pages":23,"crops":[[12,0,0.226908,1,0.7194],[13,0,0.053575,1,0.089543]]},
    "G8-T29/a/q8": {"pdf":"9a25d880f6f04ba8bfda8bcf492689aa","source":"dd5e669c76584d7327e729c8abcbbd88414e75cf5aa4d4d56bd5a2e6cb15e47e","native":"0f21d416b91cc5a09f291dcc1aa22740aff46526b08e7c5370379ace8488f38a","pages":17,"crops":[[6,0,0.058141,1,0.600088]]},
    "G8-T29/b/q10": {"pdf":"a0fc2adce8bd40b5af30d04967ced6fb","source":"e3146ab7cf9f46ed0afb62e42febd2c6b685e661bf2a1d8d694d551114173f3e","native":"6e78c456987f1347ffd15c041c0fe9218b39318a58bcb993512f3a22880b3b22","pages":18,"crops":[[9,0,0.402703,1,0.481158],[10,0,0.053575,1,0.102362]]},
    "G8-T29/c/q15": {"pdf":"c0bf9e333ab94edd907961bc85098ece","source":"d2c5e71851feb9676dbcaac4e864e23011bccc4621da66592457accb6e35b86e","native":"0268fc08fd2b4d1ad5d29821d029015c0c5b9b519e9c173d104fe0353e980dfb","pages":18,"crops":[[13,0,0.058141,1,0.600088]]},
    "G8-T29/c/q20": {"pdf":"c0bf9e333ab94edd907961bc85098ece","source":"d2c5e71851feb9676dbcaac4e864e23011bccc4621da66592457accb6e35b86e","native":"0268fc08fd2b4d1ad5d29821d029015c0c5b9b519e9c173d104fe0353e980dfb","pages":18,"crops":[[18,0,0.058141,1,0.786536]]},
    "G8-T29/c/q6": {"pdf":"c0bf9e333ab94edd907961bc85098ece","source":"d2c5e71851feb9676dbcaac4e864e23011bccc4621da66592457accb6e35b86e","native":"0268fc08fd2b4d1ad5d29821d029015c0c5b9b519e9c173d104fe0353e980dfb","pages":18,"crops":[[5,0,0.058141,1,0.655231]]},
    "G8-T35/a/q7": {"pdf":"0b35039ff7184b488eb37f1c0e37b493","source":"489f79259642a97aaffc1698946dd9f6afc46db57fede4d1931c06665dab46c9","native":"8821e429f754839e40e34cfc2918d391333179b87baa8dd03e33f142ada394e4","pages":19,"crops":[[6,0,0.351134,1,0.47895],[7,0,0.053575,1,0.611277]]},
    "G8-T52/c/q19": {"pdf":"db2190e0c1c64e999d94dabd421e151e","source":"c568b134f8e412af3da9cc5477d53bb645bfd5f8c67f8eef35abb1bb004f27e1","native":"983f12582c526a777e2ece268366e0f5adc29b087ee96d82b305cfddc0ecf279","pages":12,"crops":[[11,0,0.33985,1,0.397338]]},
    "G8-T54/a/q10": {"pdf":"62e110307021449eb26c4b5afba0e66a","source":"52a017f0134b21c94b0d9fef9f9e17bbcabcf4e143e629e283c58fbb2cb16a5b","native":"448ca1caa73a821c2e75aef7e420e31a35468fcffac6e72628b9b7fc94ca466e","pages":11,"crops":[[5,0,0.753999,1,0.212742],[6,0,0.032071,1,0.248932]]},
    "G8-T54/a/q17": {"pdf":"62e110307021449eb26c4b5afba0e66a","source":"52a017f0134b21c94b0d9fef9f9e17bbcabcf4e143e629e283c58fbb2cb16a5b","native":"448ca1caa73a821c2e75aef7e420e31a35468fcffac6e72628b9b7fc94ca466e","pages":11,"crops":[[9,0,0.205528,1,0.415883]]},
    "G8-T54/b/q20": {"pdf":"0d99670aa51c43b9ac38fc9c047c259f","source":"96b02ef70d80e99e13b3f2e6f0cc1c5f943146a0735e923e9f29f59bf1901b7b","native":"63cf42317ba3cd64e2a10b1e87e571185a202ac4426458b2a411dc7b55c1749e","pages":11,"crops":[[11,0,0.128865,1,0.837876]]},
    "G8-T54/b/q9": {"pdf":"0d99670aa51c43b9ac38fc9c047c259f","source":"96b02ef70d80e99e13b3f2e6f0cc1c5f943146a0735e923e9f29f59bf1901b7b","native":"63cf42317ba3cd64e2a10b1e87e571185a202ac4426458b2a411dc7b55c1749e","pages":11,"crops":[[5,0,0.471366,1,0.495375],[6,0,0.032071,1,0.017755]]},
    "G8-T54/c/q12": {"pdf":"ef25136f539948198e1554bd31e430de","source":"2d820cd9a6ee11db36082af50f0835fdd19381242a269e76422b1b29d29f978b","native":"b32e642016691ca7f8108ba8f58c8069ffa189a76cad66e15e21e95047ef5e5e","pages":12,"crops":[[7,0,0.577163,1,0.389578],[8,0,0.032071,1,0.095606]]},
    "G8-T54/c/q19": {"pdf":"ef25136f539948198e1554bd31e430de","source":"2d820cd9a6ee11db36082af50f0835fdd19381242a269e76422b1b29d29f978b","native":"b32e642016691ca7f8108ba8f58c8069ffa189a76cad66e15e21e95047ef5e5e","pages":12,"crops":[[11,0,0.282191,1,0.68455],[12,0,0.032071,1,0.117927]]},
    "G8-T54/c/q3": {"pdf":"ef25136f539948198e1554bd31e430de","source":"2d820cd9a6ee11db36082af50f0835fdd19381242a269e76422b1b29d29f978b","native":"b32e642016691ca7f8108ba8f58c8069ffa189a76cad66e15e21e95047ef5e5e","pages":12,"crops":[[2,0,0.282191,1,0.68455],[3,0,0.032071,1,0.017755]]},
    "G8-TWOSRC/a/q10": {"pdf":"4d3aef099bf14ae78ee1c26fae1e45c1","source":"a3ee9ca3df30dba14ed37a5829f88e79eb3841390013fbc26cc0825724d6d929","native":"771a0ca22c138958f860c10852baedb099b827655b74a4133780a53931029132","pages":11,"crops":[[7,0,0.611377,1,0.288777],[8,0,0.053575,1,0.208473]]},
    "G8-TWOSRC/a/q13": {"pdf":"4d3aef099bf14ae78ee1c26fae1e45c1","source":"a3ee9ca3df30dba14ed37a5829f88e79eb3841390013fbc26cc0825724d6d929","native":"771a0ca22c138958f860c10852baedb099b827655b74a4133780a53931029132","pages":11,"crops":[[10,0,0.058141,1,0.373117]]},
    "G8-TWOSRC/a/q14": {"pdf":"4d3aef099bf14ae78ee1c26fae1e45c1","source":"a3ee9ca3df30dba14ed37a5829f88e79eb3841390013fbc26cc0825724d6d929","native":"771a0ca22c138958f860c10852baedb099b827655b74a4133780a53931029132","pages":11,"crops":[[10,0,0.431257,1,0.45235],[11,0,0.053575,1,0.210423]]},
    "G8-TWOSRC/a/q3": {"pdf":"4d3aef099bf14ae78ee1c26fae1e45c1","source":"a3ee9ca3df30dba14ed37a5829f88e79eb3841390013fbc26cc0825724d6d929","native":"771a0ca22c138958f860c10852baedb099b827655b74a4133780a53931029132","pages":11,"crops":[[2,0,0.61208,1,0.335502],[3,0,0.053575,1,0.107113]]},
    "G8-TWOSRC/a/q6": {"pdf":"4d3aef099bf14ae78ee1c26fae1e45c1","source":"a3ee9ca3df30dba14ed37a5829f88e79eb3841390013fbc26cc0825724d6d929","native":"771a0ca22c138958f860c10852baedb099b827655b74a4133780a53931029132","pages":11,"crops":[[4,0,0.338859,1,0.481995]]},
    "G8-TWOSRC/a/q7": {"pdf":"4d3aef099bf14ae78ee1c26fae1e45c1","source":"a3ee9ca3df30dba14ed37a5829f88e79eb3841390013fbc26cc0825724d6d929","native":"771a0ca22c138958f860c10852baedb099b827655b74a4133780a53931029132","pages":11,"crops":[[5,0,0.053575,1,0.874323]]},
    "G8-TWOSRC/b/q10": {"pdf":"82c10dac2ee74d7a9ed4e2864e06d880","source":"666bf4c0ee87238223b42a00de1acf48571490c07b01c7631515ba44dae2a63a","native":"ff3f96e1f7ad21483992a5a5deeca1a9518bc87c299242e88edaedc363a5a3a2","pages":12,"crops":[[9,0,0.058141,1,0.660564]]},
    "G8-TWOSRC/b/q12": {"pdf":"82c10dac2ee74d7a9ed4e2864e06d880","source":"666bf4c0ee87238223b42a00de1acf48571490c07b01c7631515ba44dae2a63a","native":"ff3f96e1f7ad21483992a5a5deeca1a9518bc87c299242e88edaedc363a5a3a2","pages":12,"crops":[[10,0,0.562144,1,0.335784],[11,0,0.053575,1,0.203722]]},
    "G8-TWOSRC/b/q13": {"pdf":"82c10dac2ee74d7a9ed4e2864e06d880","source":"666bf4c0ee87238223b42a00de1acf48571490c07b01c7631515ba44dae2a63a","native":"ff3f96e1f7ad21483992a5a5deeca1a9518bc87c299242e88edaedc363a5a3a2","pages":12,"crops":[[11,0,0.257297,1,0.662307]]},
    "G8-TWOSRC/b/q2": {"pdf":"82c10dac2ee74d7a9ed4e2864e06d880","source":"666bf4c0ee87238223b42a00de1acf48571490c07b01c7631515ba44dae2a63a","native":"ff3f96e1f7ad21483992a5a5deeca1a9518bc87c299242e88edaedc363a5a3a2","pages":12,"crops":[[2,0,0.053575,1,0.873608]]},
    "G8-TWOSRC/b/q4": {"pdf":"82c10dac2ee74d7a9ed4e2864e06d880","source":"666bf4c0ee87238223b42a00de1acf48571490c07b01c7631515ba44dae2a63a","native":"ff3f96e1f7ad21483992a5a5deeca1a9518bc87c299242e88edaedc363a5a3a2","pages":12,"crops":[[4,0,0.058141,1,0.459673]]},
    "G8-TWOSRC/b/q6": {"pdf":"82c10dac2ee74d7a9ed4e2864e06d880","source":"666bf4c0ee87238223b42a00de1acf48571490c07b01c7631515ba44dae2a63a","native":"ff3f96e1f7ad21483992a5a5deeca1a9518bc87c299242e88edaedc363a5a3a2","pages":12,"crops":[[6,0,0.058141,1,0.513686]]},
    "G8-TWOSRC/c/q12": {"pdf":"a60c1ab2deb942ddb2d33dabcebd2485","source":"41f68ec9ed81f993a542c556827532e7b09b18f6f5e3e3f0d878d7fd1a612547","native":"f6b1316a084f613cbc2e273e8a9659314c7c079fe5ac6bd136454fa9d2388eb2","pages":10,"crops":[[9,0,0.058141,1,0.543675]]},
    "G8-TWOSRC/c/q13": {"pdf":"a60c1ab2deb942ddb2d33dabcebd2485","source":"41f68ec9ed81f993a542c556827532e7b09b18f6f5e3e3f0d878d7fd1a612547","native":"f6b1316a084f613cbc2e273e8a9659314c7c079fe5ac6bd136454fa9d2388eb2","pages":10,"crops":[[9,0,0.601815,1,0.338403],[10,0,0.053575,1,0.22936]]},
    "G8-TWOSRC/c/q14": {"pdf":"a60c1ab2deb942ddb2d33dabcebd2485","source":"41f68ec9ed81f993a542c556827532e7b09b18f6f5e3e3f0d878d7fd1a612547","native":"f6b1316a084f613cbc2e273e8a9659314c7c079fe5ac6bd136454fa9d2388eb2","pages":10,"crops":[[10,0,0.282935,1,0.626776]]},
    "G8-TWOSRC/c/q3": {"pdf":"a60c1ab2deb942ddb2d33dabcebd2485","source":"41f68ec9ed81f993a542c556827532e7b09b18f6f5e3e3f0d878d7fd1a612547","native":"f6b1316a084f613cbc2e273e8a9659314c7c079fe5ac6bd136454fa9d2388eb2","pages":10,"crops":[[2,0,0.576223,1,0.288287],[3,0,0.053575,1,0.253116]]},
    "G8-TWOSRC/c/q6": {"pdf":"a60c1ab2deb942ddb2d33dabcebd2485","source":"41f68ec9ed81f993a542c556827532e7b09b18f6f5e3e3f0d878d7fd1a612547","native":"f6b1316a084f613cbc2e273e8a9659314c7c079fe5ac6bd136454fa9d2388eb2","pages":10,"crops":[[4,0,0.647301,1,0.288777],[5,0,0.053575,1,0.226043]]},
    "G8-TWOSRC/c/q8": {"pdf":"a60c1ab2deb942ddb2d33dabcebd2485","source":"41f68ec9ed81f993a542c556827532e7b09b18f6f5e3e3f0d878d7fd1a612547","native":"f6b1316a084f613cbc2e273e8a9659314c7c079fe5ac6bd136454fa9d2388eb2","pages":10,"crops":[[6,0,0.058141,1,0.610638]]},
    "G9-T12/a/q3": {"pdf":"ecc00a3c5ad249969b5198ca85e2c045","source":"2a064a58b70fbcf9afdfac7be34511d8360dbe739302cee447a07ce003d20e31","native":"bb5363eb7050faaa1aa52048313086f18e23227d4a822815d78e692576b363fd","pages":31,"crops":[[3,0,0.154996,1,0.811745],[4,0,0.032071,1,0.017755]]},
    "G9-T12/b/q27": {"pdf":"9fc5a420822749e09faea375788670d4","source":"dabfe07649930b6570f3eb71361089b88b460688ecafb5d4c0626641c3dbfe41","native":"811153573d9074ef920da79f0071871180c93de7e482243c77aba52db27c59c1","pages":23,"crops":[[22,0,0.051014,1,0.915728],[23,0,0.032071,1,0.269175]]},
    "G9-T13/a/q17": {"pdf":"e10786e0b31e4de894b0778da9d12495","source":"d726710ee2224b2ee5d4f0403bbfbdada6b67f6c6bacd03937126aaf1e549253","native":"7801843958572e9c41f96ed8735181a70666199f878698c9e7ac9d95549b071d","pages":18,"crops":[[14,0,0.051014,1,0.915728],[15,0,0.032071,1,0.017755]]}
  };
  // These selected items explicitly name one panel; keep their verified primary
  // mapping. Other items in the same question may require the complete set.
  var SINGULAR = {
    "G9-T13/a/q17": ["q17b"], "G7-T24/a/q20": ["q20c", "q20d"],
    "G8-T29/c/q20": ["q20a", "q20c"], "G8-T35/a/q7": ["q7d"]
  };
  var URL = /^(\/noam-ai\/native\/(G[789]-(?:T[0-9]+|ASSESS1|CIRCLE|INTERP|TWOSRC|3060|KITE|SIDEANG|TRAP))\/([abc])\/)figures\/(q[0-9]+_head(?:_[2-9])?)\.svg$/;
  function route(exercise) {
    var m = String(exercise && exercise.nativeFigureUrl || "").match(URL);
    if (!m || !/^q[0-9]+$/.test(exercise.nativeQuestionId || "")) return null;
    var key = m[2] + "/" + m[3] + "/" + exercise.nativeQuestionId;
    if (!REVIEWED[key] || (SINGULAR[key] || []).indexOf(exercise.nativeItemId) >= 0) return null;
    return { key: key, prefix: m[1], count: REVIEWED[key] };
  }
  // Routing only. A true result is not proof: references/resolve must succeed.
  function isReviewed(exercise) { return !!route(exercise); }
  function approvedCrop(manifest, exercise) {
    var r = route(exercise), approval = r && APPROVED_CROPS[r.key];
    // A sheet republished with its final answers appended keeps the approved
    // PDF's question pages (questionPagesIdenticalTo); only pages are added.
    var republished = !!approval && !!manifest && manifest.pdfHash !== approval.pdf &&
      Array.isArray(manifest.questionPagesIdenticalTo) && manifest.questionPagesIdenticalTo.indexOf(approval.pdf) !== -1;
    if (!approval || !manifest || (manifest.pdfHash !== approval.pdf && !republished) || manifest.sourceSha256 !== approval.source ||
        manifest.nativeExportSha256 !== approval.native || manifest.nativeExportUrl !== r.prefix + "noam-ai.json" ||
        (republished ? !(manifest.pageCount > approval.pages) : manifest.pageCount !== approval.pages) ||
        !Array.isArray(manifest.exercises)) return null;
    var current = manifest.exercises.filter(function(e){return e && e.id === exercise.id;});
    if (current.length !== 1 || ["q","part","nativeQuestionId","nativeItemId","nativeFigureId","nativeFigureUrl"].some(function(k){return current[0][k] !== exercise[k];})) return null;
    function cropValues(crops) {
      if (!Array.isArray(crops) || crops.length !== approval.crops.length) return null;
      var result = [];
      for (var c of crops) {
        if (!c || Object.keys(c).some(function(k){return ["page","x","y","w","h"].indexOf(k) < 0;}) ||
            ![c.page,c.x,c.y,c.w,c.h].every(Number.isFinite) || !Number.isInteger(c.page) || c.page < 1 || c.page > approval.pages ||
            c.x < 0 || c.y < 0 || c.w <= 0 || c.h <= 0 || c.x + c.w > 1.000001 || c.y + c.h > 1.000001) return null;
        result.push([c.page,c.x,c.y,c.w,c.h]);
      }
      return JSON.stringify(result);
    }
    var expected = JSON.stringify(approval.crops);
    if (cropValues(exercise.crops) !== expected || cropValues(current[0].crops) !== expected) return null;
    return { pageCount: approval.pages, sourceKey: r.key, pdfId: approval.pdf, sourceSha256: approval.source };
  }
  function pair(value) { return Array.isArray(value) && value.length === 2 && value.every(Number.isFinite); }
  function attributes(raw) {
    var out = Object.create(null), m, re = /([\w:-]+)\s*=\s*["']([^"']*)["']/g;
    while ((m = re.exec(raw))) { if (Object.prototype.hasOwnProperty.call(out, m[1])) return null; out[m[1]] = m[2]; }
    return out;
  }
  function validSvg(text, panel) {
    if (typeof text !== "string" || text.length > 1500000 || /<!DOCTYPE|<!ENTITY|<(?:[\w-]+:)?(?:script|foreignObject|iframe|object|embed|link)\b|@import|\son[a-z]+\s*=/i.test(text)) return false;
    var opening = text.match(/<svg\b([^>]*)>/i), a = opening && attributes(opening[1]);
    if (!a || !a.viewBox) return false;
    var box = a.viewBox.trim().split(/[ ,]+/).map(Number);
    if (box.length !== 4 || !box.every(Number.isFinite) || box[0] !== 0 || box[1] !== 0 ||
        Math.abs(box[2] - panel.width) > .03 || Math.abs(box[3] - panel.height) > .03) return false;
    var ids = Object.create(null), m, re = /\bid\s*=\s*["']([^"']+)["']/g;
    while ((m = re.exec(text))) { if (ids[m[1]]) return false; ids[m[1]] = true; }
    // Source SVGs may use internal clip/marker references, never external media.
    re = /(?:href|xlink:href)\s*=\s*["']([^"']*)["']/gi;
    while ((m = re.exec(text))) { if (!/^#[A-Za-z0-9_-]+$/.test(m[1])) return false; }
    re = /url\(\s*["']?([^)'"\s]+)["']?\s*\)/gi;
    while ((m = re.exec(text))) { if (!/^#[A-Za-z0-9_-]+$/.test(m[1])) return false; }
    // A header-only or definitions-only SVG is not a usable original panel.
    // Require at least one bounded visible geometry primitive outside <defs>.
    var visible = text.replace(/<defs\b[^>]*>[\s\S]*?<\/defs\s*>/gi, ""), ink = false;
    re = /<(line|path|circle|ellipse|polygon|polyline|rect)\b([^>]*)>/gi;
    while ((m = re.exec(visible))) {
      var shape = attributes(m[2]); if (!shape) return false;
      var tag = m[1].toLowerCase(), numeric = function(name){ return shape[name] !== undefined && Number.isFinite(Number(shape[name])); };
      if (tag === "line" && ["x1","y1","x2","y2"].every(numeric) && (shape.x1 !== shape.x2 || shape.y1 !== shape.y2)) ink = true;
      else if (tag === "path" && /[MLCQAHVmlcqahv]/.test(shape.d || "") && /[0-9]/.test(shape.d || "")) ink = true;
      else if (tag === "circle" && numeric("r") && Number(shape.r) > 0) ink = true;
      else if (tag === "ellipse" && ["rx","ry"].every(numeric) && Number(shape.rx) > 0 && Number(shape.ry) > 0) ink = true;
      else if (tag === "rect" && ["width","height"].every(numeric) && Number(shape.width) > 0 && Number(shape.height) > 0) ink = true;
      else if (/^(polygon|polyline)$/.test(tag) && (shape.points || "").trim().split(/[ ,]+/).length >= 4 && (shape.points || "").trim().split(/[ ,]+/).every(function(n){return n !== "" && Number.isFinite(Number(n));})) ink = true;
    }
    return ink && /<\/svg\s*>/i.test(text);
  }
  function visibleNames(model) {
    var out = [];
    model.objects.forEach(function (o) {
      if (o.display !== "initial" || o.type === "label") return;
      var name = String(o.name || "");
      if (o.type === "axis" && /^axis:[xy]$/.test(o.id)) name = o.id.slice(-1);
      if (o.part === "axis" && /^axis-[xy]$/.test(name)) name = name.slice(-1);
      if (/^[A-Za-z]{1,8}$/.test(name) && out.indexOf(name) < 0) out.push(name);
    });
    return out.slice(0, 24);
  }
  function descriptor(figure, qid, prefix, id) {
    var model = figure && figure.visual_model, view = figure && figure.view && figure.view.viewbox;
    if (!figure || figure.id !== id || figure.question !== qid || figure.item || figure.svg !== "figures/" + id + ".svg" ||
        !model || model.schema_version !== "visual-model/v1" || model.id !== id || model.question !== qid || model.item || model.svg !== figure.svg ||
        /^(answer|to_prove|to_construct|aux)$/.test(figure.role || "") || /^(answer|to_prove|to_construct|aux)$/.test(model.role || "") ||
        figure.display === "hidden" || model.display === "hidden" || (Array.isArray(model.aux) && model.aux.length > 0) ||
        !/^(coordinate_plane|plane_geometry|solid_3d|function_graph|number_line)$/.test(model.kind || "") ||
        !Array.isArray(model.objects) || model.objects.length > 15000 || !pair(view) || view.some(function(n){return n < 20 || n > 4000;})) return null;
    if (model.view && (!pair(model.view.viewbox) || model.view.viewbox.some(function(n,i){return Math.abs(n-view[i]) > .03;}))) return null;
    var ids = Object.create(null);
    for (var o of model.objects) {
      if (!o || typeof o.id !== "string" || ids[o.id] || /^(answer|to_prove|to_construct|aux)$/.test(o.role || "") ||
          ["initial", "given_highlight"].indexOf(o.display) < 0) return null;
      ids[o.id] = true;
      if (o.svg_xy) {
        var points = pair(o.svg_xy) ? [o.svg_xy] : o.svg_xy;
        if (!Array.isArray(points) || points.some(function(p){return !pair(p) || p[0] < -.1 || p[1] < -.1 || p[0] > view[0] + .1 || p[1] > view[1] + .1;})) return null;
      }
    }
    return { id: id, url: prefix + figure.svg, kind: model.kind, width: view[0], height: view[1], visibleNames: visibleNames(model) };
  }
  function references(data, exercise, primarySvgText, nativeApi) {
    var r = route(exercise), native = nativeApi || root && root.NoamNativeVisual;
    if (!r || !native || typeof native.authoredContext !== "function" || !data || !Array.isArray(data.figures)) return null;
    var context;
    try { context = native.authoredContext(data, exercise, primarySvgText); } catch (_) { return null; }
    if (!context || !context.hasFigure) return null;
    var qid = context.questionId, ids = [qid + "_head"];
    for (var i = 2; i <= r.count; i++) ids.push(qid + "_head_" + i);
    if (r.count < 2 || r.count > 3 || ids.indexOf(exercise.nativeFigureId) < 0) return null;
    var candidates = data.figures.filter(function(f){return f && f.question === qid && new RegExp("^" + qid + "_head(?:_[0-9]+)?$").test(f.id || "");});
    if (candidates.length !== ids.length || candidates.some(function(f){return ids.indexOf(f.id) < 0;})) return null;
    var panels = [];
    for (var id of ids) {
      var matches = data.figures.filter(function(f){return f && f.id === id;});
      if (matches.length !== 1) return null;
      var panel = descriptor(matches[0], qid, r.prefix, id);
      if (!panel) return null;
      panels.push(panel);
    }
    if (!validSvg(primarySvgText, panels[ids.indexOf(exercise.nativeFigureId)])) return null;
    // These printed questions mix worked examples and practice. Preserve the
    // originals, but never offer example object names as selected-item givens.
    var printedRoles = r.key === "G8-TWOSRC/a/q7" || r.key === "G8-TWOSRC/b/q2";
    if (printedRoles) panels.forEach(function(panel){ panel.visibleNames = []; });
    return { requiresPrintedRoleContext: printedRoles, kind: "source-panel-group", sourceKey: r.key, questionId: qid, itemId: context.itemId,
      exerciseId: exercise.id, primaryPanelId: exercise.nativeFigureId, panelIds: ids, panels: panels };
  }
  function resolve(data, exercise, svgById, nativeApi) {
    if (!exercise || !svgById || typeof svgById !== "object" || Array.isArray(svgById)) return null;
    var group = references(data, exercise, svgById[exercise.nativeFigureId], nativeApi);
    if (!group || Object.keys(svgById).length !== group.panels.length || Object.keys(svgById).some(function(id){return group.panelIds.indexOf(id) < 0;})) return null;
    return group.panels.every(function(panel){return validSvg(svgById[panel.id], panel);}) ? group : null;
  }
  function metadata(group) {
    return group && group.kind === "source-panel-group" ? group.panels.map(function(panel){
      return {id:panel.id,kind:panel.kind,visibleNames:panel.visibleNames.slice()};
    }) : [];
  }
  function render(document, data, exercise, svgById, nativeApi) {
    var group = resolve(data, exercise, svgById, nativeApi); if (!group) return null;
    var container = document.createElement("div");
    container.className = "noam-source-panel-group"; container.setAttribute("data-visual-kind", "source-context");
    group.panels.forEach(function(panel){
      var figure = document.createElement("figure"); figure.className = "noam-native-figure noam-geometry";
      figure.setAttribute("data-source-panel-id", panel.id);
      var ns = "http://www.w3.org/2000/svg", svg = document.createElementNS(ns, "svg");
      svg.setAttribute("viewBox", "0 0 " + panel.width + " " + panel.height);
      svg.setAttribute("role", "img"); svg.setAttribute("aria-label", "תרשים מקורי מתוך השאלה; הכיתובים והמיקום מופיעים בתמונת השאלה.");
      svg.setAttribute("class", "noam-geometry-svg");
      // Keep the already validated source bytes in an isolated image document.
      // A second fetch could fail or change after the complete set was checked.
      var image = document.createElementNS(ns, "image");
      image.setAttribute("href", "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgById[panel.id]));
      image.setAttribute("width", String(panel.width)); image.setAttribute("height", String(panel.height)); svg.appendChild(image);
      svg.style.cssText = "display:block;width:100%;height:auto;max-height:480px;background:white";
      figure.appendChild(svg);
      var caption = document.createElement("figcaption"); caption.textContent = "תרשים מקורי מהשאלה. ללא הדגשה נוספת.";
      figure.appendChild(caption); container.appendChild(figure);
    });
    return container;
  }
  return { isReviewed:isReviewed, approvedCrop:approvedCrop, references:references, resolve:resolve, render:render, metadata:metadata };
});
