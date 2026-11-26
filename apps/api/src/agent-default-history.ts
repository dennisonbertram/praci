import { createHash } from "node:crypto";

/**
 * SHA-256 of every default the built-in agents have shipped, per kind. A stored agent whose
 * instructions hash to a `past` entry is still on an old default and is upgraded to the current one;
 * any other text is the owner's edit and is never touched (see agent-instruction-upgrades.ts and each
 * agent's ensure function). `current` is the hash of today's default.
 *
 * When you change a default constant, move the old `current` hash into `past` and put the new hash in
 * `current`. agent-default-history.test.ts fails until you do, so no shipped default is forgotten.
 * Print a hash with: node -e 'console.log(require("crypto").createHash("sha256").update(TEXT).digest("hex"))'.
 */
export const AGENT_DEFAULT_HASHES: Record<string, { current: string; past: string[] }> = {
  carta: {
    current: "cafda7d46465064d8df3f26bad7ec4bf6f87861db28c1dceb5fe50e4c835f48b",
    past: [
      "efad8c04aaccbd157aad647461d0a5605613e0dba2216fc586ecf3119be7439a",
      "9c95c29e553466590b7993a001f99873c7bc1c1a689e395ad58df74564a57ff3",
      "a3792c6375371d1101d18f987e611c036db380a52331522e504f23a08d38fc41",
      "c7342384ac7bc13db68435f9af15f34443924c5f3b3391d71e508a769770c8bb",
      "a8dd19250ba28f20ec6eb5ffa6e406183caba82186839b319ab592a865e8069a",
      "41068a9b27abf1f42c15150c0e4ea4e52eded7c17fcc6d8377cbaf9ce7f2ef72",
      "3fdc09cc873d0b1d4ffb3f5ace0d2fed31c66d43eb12237f22cb122e74a693f7",
      "ce5bfda4cedf6b689b71e4975b17e94b488ea95d3aa517dcb692c8fb60b0f26e",
      "2ac80670358ad25b03d1b2d14e4d48022ffbfb577439a5c5560ed742517e1015",
      "132789aecc862e1ad316c712bfc24e51b8a33e7f2c5e3d89d05141fcc5f84fe9",
      "e969836b28dc19ec675cace0ef2d32e70f899a66a1c60bbe72d545842ea7ec45",
    ],
  },
  company: {
    current: "fa87188dff2cd9e5dd8fe2d27f6d5d03c88f6d99112e52114ebf5d9fe29b76fc",
    past: [
      "b39ea7f575ab3167756ee9ac8b0154c3503953d351e58d63c32aeb18e8173f07",
      "e32f87da6062f722cedc9151d613e2b0e7cb08e86276131395cb4130542e8f95",
    ],
  },
  "company-importer": {
    current: "04cfcbedb4c98d1c19f6f3d7f7d49f2a3a93e3db1ae385ee9f608faf8b6c5975",
    past: [],
  },
  "data-room": {
    current: "437ad50f94b178061ce7e2cef37bb40564dd067b1e550eb8f53603e8bf5359ff",
    past: [
      "6ed5416f7b61f228f59f0805c1a199603bcab08ba0a20504d081fd72aedfea9a",
      "a2fd66577cd93056741c32297535bf8c752e90b6327eea6af825d41df254625c",
      "dd5c95445266951b6bee9de21800000b3e01ca219535398f05a26abfc3121ffa",
      "3a5f97b681a85f53f526b9af16b43802c479e8b0cdf0d0e160044562d80ee162",
      "09960da484d9f431a61b124dceab4d691273b09d92e78ab580987b19dd093026",
    ],
  },
  finance: {
    current: "acd2a733db926f96916b098df1041c5037a3988ba87f8b6caa35c73e4d67c84b",
    past: [
      "80ba1f4d7bfa596e321d1e5f3cc3a2a74dbc7837a838c3128de9bb1763574677",
      "96fd0b7345d04dcdf0a7cdb0a8723a9fffd1647cce46b5fdeb8616fe1494be25",
      "bfd12c5769877a3e70c54aafed4eff9f8397cacf3b0cf16cc2a768aa588cd66e",
      "52a1403922ff92697f4df0e166211c40188749ceea8e3865904e9e9cabd006a8",
      "3a45c09b310499328ad78eca8d8bbb884f5f399ae1a8b24bd61f6487c35e0a79",
      "3cba4fbff42a26e8512d45d89ae92514799438dcbfbcd0fe1f6fd5dff543991f",
      "8ccfa5e3167586abbe8b00e9ad36a81efd018b0091a5717f1821255bbd9c686c",
      "7d1a9718ed918ca40c12e3b807a136645952b26390aeab2ce38d23c49f63399b",
      "8efdda0e712ac272823f6405bcdfc76414c464ca755004af73f5406d861c08e8",
      "3889c96c5ea116a66c62af3a1c20ef98308b04fd645871f65966e95a7c389459",
      "343999fbb90ca06f2b29f395d9d118ba4f20b9bd268fc1385da4e82cc9794ff2",
      "442fe959db1f5ff901fc602e4da524c3467976e1f65429c600604a11f32c0ca6",
      "19cb0d1628dc06a36e665335d11a6318ebdd322f212021223d22a278a20a8646",
      "39d19ddf46a2971a53fee0b3fca614ed3413557c3908864dc8ebafaa242f7b4c",
    ],
  },
  gtm: {
    current: "ae8b52feb9e042cd0acb32e843984336751a33cf370e4d3d90a25f1ac0c644e0",
    past: [
      "7bf878b17c4b5c666b7a12788a97591ee5bb1f0cc0bf89982346852069142c0c",
      "6798cc163ef3f57b9c9b937a3e194ce99096c179d88fc9b99bca6cb3563c9850",
      "cf98649335031c2ef6088da54922dd4aaf7d865dd9592df6d54960de0a76c023",
    ],
  },
  inbox: {
    current: "d85d1998610f2a0c7acdb934eeeff17b093ddf1ae7c942ef203d9ed3320679a5",
    past: [
      "c430e7fc5991562b36ba90e8b1cc991776c6f5cd1ffb64617eb2166ccdca37c1",
      "43a7f661d2303292e61d9842a9dfa72d41281ee6fd41bab12ddd97ff2ec2672c",
      "db1c1ed3a35ee4ac50f3d14f7906e9a318dfba7064129da2d5cb2678d77c574a",
      "f6e825ecfc390c474393396e2975976771440a3758cee9b8cdf31c10a34e489e",
      "0f8d8113a669fdd8f41cd6cb9517baf0b80252433a49da5cb17541d07a188473",
      "3db3695c73b900c2909463eae9cec2b7be94c82ff3716c863ef33d9fa2acbaaf",
      "2ba13eaca3ce0d02055dca9cf691de6af1a7222c117744b170ef7c793a657c3f",
      "a452532a6e8e9e129d3ac08e5f512bae252ae3bb95860d17484013d882198435",
      "dc4f3e8fd3067bbcee26d0d32d65dfc474151b3918f206966a2a8c254fad02c3",
      "b5b4d8a968981911db7911b3bfaba7f783cbdd5c9e0d3103eae81b549a43ae58",
      "59e5b4a126d60cdad5a04ca989637575daa7e6f5ecee99057bfa53056717c7b2",
      "ae59436fe18c958b9f6e76a5441115ceb35cb48cb322e3240bfba901382ae33e",
      "ae2597be75a856083531c9c239db9626c0dc31903af81652d0452bb9efd6c419",
      "73d0851cbf21b36a13c749f3fff369bbd542940b7d050952834f491928020cbc",
      "f9f7e7079778709ff70fb265ff06ee45e51ff831e1cb25d376072b2384bff32a",
      "ec77e28da21bff5e62e716681c9ab17e5db81c06292db212c72b99911fed55bf",
    ],
  },
  investors: {
    current: "afcfdbc07eadba651009f6a1cd640cfe6aaeb7b01803ae390079f936ea2686aa",
    past: [
      "a7fc574d41867c3ad74e8da90be9838483db2199c79cf8043fc8876df165d8c0",
      "cae501926de7ef9e354077e02247c398db716da05475ab0b9c2b5440a46844c4",
      "9bbc2eff839fb9bb44f8cf30ede1297838a9256eda58b1e97d1f05fcbaff116a",
      "37f7a321ad300f58bf82ea048444b47e259d0b4035a00d46f67b5b04063fb677",
      "cb8966528abe3e84f1331998b19259240efe100cf42750c3d1340cb2617a6b87",
      "f33cf5a1e0400eb1f205cdcba9709e91202a7d7bf9e05061db141a3330b71d16",
      "cefaf03927af6a53d85b0ed5387f41b137ecc564c354708b25b9622a1b2de773",
      "2973cb0cc9c37ad5d1193a5ea613471b2480d6e829d5bf5e6ea9fe076a55d60d",
      "251f2e07976020dd9f0f2940cb7bbedc53086b4b82e85bcd4aa12c6a85361b8e",
      "2bc60aee286805a05c96ffa820af95c61eb2e5284cb85fadbe87512a93ab22d1",
      "d1d7a0dfbe9c92211fdb0e0cb03daf241d8d136f5c2ec10fa4364af266962328",
      "b0dae7c067a05b67149f7a5ddf8bfd6e1d67c06b0aa80fb006ab8a7ddc82701c",
      "e40aae7c5d711ac186968d1a47a7f5684b070e7687f7ccd99e1c3fc8ee4a45f7",
      "aa27cfd4616e02493cf22eccb33903fc22c4cf75f1e747da37b5396440c32756",
      "b3da15e8272eeaea35cb44146b3b097d7576cfc2b99f5f06dbc5413e2a5a655d",
      "5b489623a7b5b18b56a0c3dcf0df9d057f3c629ec83be0862138404f19497cd5",
      "638a2de047b0183d2bf99503024afd711b47b1bf6ed3ada294c882734ac5f6a3",
      "46750002cc373aa90f104937a7d96d04695d0010218f12b288b2bb0f82556638",
      "d35216532152fa6522012c96bc14bff0e07bf1a0bc7ed91d55a922c5147f512e",
      "168dce550784bbb06c0ef8f1363d73418955db79043456ac492815f1d75435bb",
      "e65f83ca04014e76217997f7b24b5551bcee385af99159cfcee7b34a491ce68b",
      "8193e071af26813798822b453c368fab25107246e056379464d61b12bed2c0a4",
      "0c7628688b25ca846f28ac6bb2adb7de12d10710d0d9a02526f496eb361a8e8f",
      "867e00ac560e16b85e16253d2dba47b4e182ca43a0f291d2061473bbd6771ad9",
      "271b12c2f95015fbab996602874299a6d2f5b394dace523a259dfc347b1c969e",
      "19b52d832b3b7b2da543c166f7d636f5e44bf27f363674515d9133229e39ac8c",
      "17ec3537e1c938312c94e4a3852930da60e57adc8036cd7106f36412924be5f2",
      "18ada3c746cee8d7300d377652a2bffd7469b4a0849c56639dddd0fde5b1d728",
      "bdb7253b83c8d1e97498466abbc489051446a577f05c9052c32edf8892ba46ca",
    ],
  },
  scanner: {
    current: "bd5f09a5783a9812fbd81a7c29af839f57785455a3765cfb654ee042d6f5f9cd",
    past: [],
  },
  legal: {
    current: "5eab7b0830aabfbf4eecd07316bbfa2f6359c762e75f94708548dba9270252f8",
    past: [
      "2c6e80842e3eda409c0faec7e3a9f659bc66d6858c44a9ef5f334d14eaf94fee",
      "37d7a6b2620b2bd1bcfc54d0c8540fc30bf5231427c10aa74af69b4cb76df025",
      "9fd34f46830609ddce30661942fa06a2de7be4d40faec243cf7212b5a817bd50",
      "6586882767e604dd103bb895ba129fdf0888bc14762b88db1a4836fd12f42228",
      "85d3f440562e6f32fe1e6a73e2696141f1ae4c232fcb6d6cf5c5f5b5a963c2df",
      "9ae3a7efddf2085f8263588f5536501d6cb25bfe515485814535dc0570a4d7dd",
      "34ebcc18e392b79d7a45cce92a138aaf8cca35c6bdd4373b4f22296ae7ab4019",
      "2d47a8f11fba46278d0e78e894b9e3919fb57aceb51254d7713f1f8671639d43",
      "f718760a8927f256b7c04ca8fd7d25f02c81ef3bc4fdcfc95021f14280805269",
      "7cab3653675654afe9753bc69a5d513b67c9c2feb3c6595c5d252cf499edc910",
      "ab401b09386b77546bb223f50cd71d7d079bca8816f7f2db07ad103f99b97f10",
      "53e7072f70f8e5c494a5126077d692a64c71a46f046658e9340e01c941e3766b",
      "4fc15c1d719e6713a1d2db77db9d47f7bcde10000be9a2245f59995ceb8ee9b7",
    ],
  },
};

const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");

/** True when `text` is exactly an earlier shipped default of this agent kind (not the current one). */
export function isPastDefault(kind: string, text: string): boolean {
  return (
    typeof text === "string" && (AGENT_DEFAULT_HASHES[kind]?.past.includes(sha256(text)) ?? false)
  );
}
