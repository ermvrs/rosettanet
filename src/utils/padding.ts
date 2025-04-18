import BigNumber from 'bignumber.js'

export function hexPadding(value: string, targetLength: number): string {
  if (value.length === 0) {
    return '0x' + '0'.repeat(targetLength)
  }
  if (!isHex(value) || value.length > targetLength) {
    return value
  }
  if (value.startsWith('0x')) {
    return '0x' + value.substring(2).padStart(targetLength, '0')
  }
  return '0x' + value.padStart(targetLength, '0')
}

export function removeHexZeroes(val: string): string {
  const prefixRemoved = removeHexPrefix(val)

  const bn = new BigNumber(prefixRemoved, 16)

  return addHexPrefix(bn.toString(16))
}

export function addHexPadding(
  value: string,
  targetLength: number,
  prefix: boolean,
): string {
  if (value.length === 0) {
    return prefix ? '0x' + '0'.repeat(targetLength) : '0'.repeat(targetLength)
  }
  if (value.length >= targetLength) {
    return value
  }
  if (value.startsWith('0x')) {
    return prefix
      ? '0x' + value.substring(2).padStart(targetLength, '0')
      : value.substring(2).padStart(targetLength, '0')
  }
  return prefix
    ? '0x' + value.padStart(targetLength, '0')
    : value.padStart(targetLength, '0')
}

// Also account of 0x prefix
function isHex(h: string): boolean {
  return /^0x[0-9A-Fa-f]*$/.test(h)
}
export function removeHexPrefix(hex: string): string {
  return hex.replace(/^0x/i, '')
}
export function addHexPrefix(hex: string): string {
  return `0x${removeHexPrefix(hex)}`
}
// data must be 256 bits
export function getLast160Bits(data: string): string {
  if (data.startsWith('0x')) {
    data = data.slice(2);
  }

  if (data.length !== 64) {
    throw new Error('Input must be 256 bits (64 hex characters)');
  }

  const last160Bits = data.slice(-40);

  return '0x' + last160Bits;
  
}