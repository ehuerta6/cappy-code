import java.util.HashMap;
import java.util.List;
import java.util.Map;

class Solution {
  public int[] twoSum(List<Integer> numbers, int target) {
    Map<Integer, Integer> seen = new HashMap<>();
    for (int index = 0; index < numbers.size(); index++) {
      int complement = target - numbers.get(index);
      if (seen.containsKey(complement)) {
        return new int[] { seen.get(complement), index };
      }
      seen.put(numbers.get(index), index);
    }
    return new int[] {};
  }
}
