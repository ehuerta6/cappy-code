#include <unordered_set>
#include <vector>

class Solution {
 public:
  bool containsDuplicate(vector<int>& numbers) {
    unordered_set<int> seen;
    for (int number : numbers) {
      if (seen.count(number)) {
        return true;
      }
      seen.insert(number);
    }
    return false;
  }
};
