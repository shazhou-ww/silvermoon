const ULID_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** @pure */
function encode(value: bigint, length: number) {
  let encoded = "";
  for (let index = 0; index < length; index += 1) {
    encoded = ULID_ALPHABET[Number(value & 31n)] + encoded;
    value >>= 5n;
  }
  return encoded;
}

/** @pure */
export function encodeUlid({
  now,
  random,
}: {
  now: number | bigint;
  random: Uint8Array;
}) {
  const randomHex = Buffer.from(random).toString("hex");
  return encode(BigInt(now), 10) + encode(BigInt(`0x${randomHex}`), 16);
}
