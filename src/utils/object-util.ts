/**
 * 判断目标是否是简单类型
 * @param target
 * @returns 是否是简单类型
 */
export function isSimpleValue(target: any): boolean {
  let isSimpleValue = true;
  if (target) {
    switch (typeof target) {
      case "object":
      case "function":
        isSimpleValue = false;
        break;
      default:
        break;
    }
  }
  return isSimpleValue;
}
