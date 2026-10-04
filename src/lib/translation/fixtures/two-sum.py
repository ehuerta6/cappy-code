class Solution:
    def twoSum(self, numbers: list[int], target: int) -> list[int]:
        seen = {}
        for index in range(len(numbers)):
            complement = target - numbers[index]
            if complement in seen:
                return [seen[complement], index]
            seen[numbers[index]] = index
        return []
