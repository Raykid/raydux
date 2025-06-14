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

/**
 * 浅表对比
 * @param arr1
 * @param arr2
 * @returns
 */
export function isShallowEquals(arr1: any[], arr2: any[]) {
  // 如果长度不相同则不同
  if (arr1.length !== arr2.length) {
    return false;
  }
  // 首层的每一项都要相等才算相等
  return arr1.every((dep, index) => {
    return dep === arr2[index];
  });
}
