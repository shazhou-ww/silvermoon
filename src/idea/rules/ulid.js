const ULID_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** @pure */
function encode(value, length) {
  let encoded = "";
  for (let index = 0; index < length; index += 1) {
    encoded = ULID_ALPHABET[Number(value & 31n)] + encoded;
    value >>= 5n;
  }
  return encoded;
}

/** @pure */
export function encodeUlid({ now, random }) {
  return encode(BigInt(now), 10) + encode(BigInt(`0x${Buffer.from(random).toString("hex")}`), 16);
}
