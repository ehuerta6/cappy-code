import {
  languages,
  type Language,
  type Problem,
  type SolutionApproach,
} from './domain';

export type ProblemReadiness = {
  warnings: string[];
  approaches: Array<{ id: string; name: string; missingLanguages: Language[] }>;
};

export function getProblemReadiness(
  problem: Pick<
    Problem,
    'title' | 'description' | 'exampleInput' | 'exampleOutput'
  >,
  approaches: SolutionApproach[],
): ProblemReadiness {
  const warnings: string[] = [];
  const title = problem.title.trim();
  if (!title || /^untitled problem$/i.test(title))
    warnings.push('Add a meaningful title');
  if (!problem.description.trim()) warnings.push('Add a description');
  if (!problem.exampleInput.trim()) warnings.push('Add example input');
  if (!problem.exampleOutput.trim()) warnings.push('Add example output');
  if (approaches.length === 0) warnings.push('Add an Approach');

  const approachReadiness = approaches.map((approach) => {
    const missingLanguages = languages.filter(
      (language) => !approach.solutions[language].code.trim(),
    );
    if (missingLanguages.length === languages.length) {
      warnings.push(`${approach.name}: no Solutions prepared`);
    } else if (missingLanguages.length > 0) {
      warnings.push(
        `${approach.name}: ${missingLanguages.map(languageName).join(', ')} not prepared`,
      );
    }
    return { id: approach.id, name: approach.name, missingLanguages };
  });

  return { warnings, approaches: approachReadiness };
}

function languageName(language: Language) {
  return language === 'cpp' ? 'C++' : language === 'java' ? 'Java' : 'Python';
}
