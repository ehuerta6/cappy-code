#include <vector>
#include <unordered_map>
using namespace std;

class Solution {
 public:
  vector<int> twoSum(vector<int>& numbers, int target) {
    unordered_map<int, int> seen;
    for (int index = 0; index < numbers.size(); index++) {
      int complement = target - numbers[index];
      if (seen.count(complement)) {
        return {seen[complement], index};
      }
      seen[numbers[index]] = index;
    }
    return {};
  }
};
