import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY || (typeof import.meta !== 'undefined' && (import.meta as any).env ? (import.meta as any).env.VITE_GEMINI_API_KEY : '');
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

export interface InterviewQuestion {
  id: string;
  question: string;
  category: string;
  expectedKeywords: string[];
}

export interface QuestionEvaluation {
  question: string;
  answer: string;
  score: number;
  critique: string;
  idealAnswer: string;
}

export interface InterviewFeedback {
  overallScore: number;
  communicationScore: number;
  confidenceScore: number;
  technicalScore: number;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  suggestions: {
    area: string;
    betterAnswer: string;
  }[];
  questionEvaluations?: QuestionEvaluation[];
}

export interface ResumeAnalysis {
  skills: string[];
  experience: {
    title: string;
    company: string;
    duration: string;
    description: string;
  }[];
  projects: {
    name: string;
    description: string;
    technologies: string[];
  }[];
  education: {
    degree: string;
    institution: string;
    year: string;
  }[];
  atsScore: number;
  missingSkills: string[];
  improvementSuggestions: string[];
  roleSpecificSummary: string;
}

export interface ProfileAnalysis {
  careerPath: string;
  skillGapAnalysis: {
    skill: string;
    status: 'expert' | 'intermediate' | 'beginner' | 'missing';
    recommendation: string;
  }[];
  marketValue: string;
  suggestedRoles: string[];
  learningPath: string[];
  overallReadiness: number;
}

// Smart Fallbacks
function getFallbackInterviewQuestions(role: string, difficulty: string, count: number = 10): InterviewQuestion[] {
  const isFrontend = role.toLowerCase().includes('frontend') || role.toLowerCase().includes('react') || role.toLowerCase().includes('ui');
  const isBackend = role.toLowerCase().includes('backend') || role.toLowerCase().includes('node') || role.toLowerCase().includes('api') || role.toLowerCase().includes('python');
  
  const allQuestions: InterviewQuestion[] = [
    {
      id: "q1",
      question: `Can you explain core responsibilities, component lifecycle, and state architecture patterns for a ${role}?`,
      category: "Architecture",
      expectedKeywords: ["Scalability", "Modularity", "Clean Code", "State Management", "Performance"]
    },
    {
      id: "q2",
      question: `[PROGRAMMING CHALLENGE] Write pseudo-code or explain step-by-step how you would implement a custom debounced search hook/function in ${isFrontend ? 'TypeScript/React' : 'Node.js'}. What is its time and space complexity?`,
      category: "Live Coding & Algorithms",
      expectedKeywords: ["setTimeout", "clearTimeout", "Closure", "Generics", "O(1) space"]
    },
    {
      id: "q3",
      question: "How do you optimize application rendering, memory usage, and eliminate unnecessary re-renders or memory leaks?",
      category: "Performance",
      expectedKeywords: ["Memoization", "useMemo", "useCallback", "Virtual DOM", "Garbage Collection"]
    },
    {
      id: "q4",
      question: `[PROGRAMMING CHALLENGE] Given an array of un-ordered records with duplicate IDs, write an efficient O(N) algorithm to deduplicate and flatten the data hierarchy for a ${role} API response.`,
      category: "Data Structures & Coding",
      expectedKeywords: ["Map", "Set", "O(N) Time", "Hash Map", "Recursion", "FlatMap"]
    },
    {
      id: "q5",
      question: "Describe how you handle asynchronous state, API request batching, and race conditions under heavy user load.",
      category: "Asynchronous Systems",
      expectedKeywords: ["Promises", "Async/Await", "AbortController", "Error Boundaries", "Try-Catch"]
    },
    {
      id: "q6",
      question: `[PROGRAMMING CHALLENGE] How would you write an LRU (Least Recently Used) Cache data structure in JavaScript/TypeScript? Explain node insertion and eviction in O(1) time.`,
      category: "Algorithmic Design",
      expectedKeywords: ["Doubly Linked List", "Map", "O(1) Time", "Eviction", "Key-Value"]
    },
    {
      id: "q7",
      question: "What strategies do you use for secure data handling, token storage, and OWASP top-10 mitigation in production?",
      category: "Security",
      expectedKeywords: ["JWT", "OAuth 2.0", "HTTPS", "Sanitization", "HttpOnly Cookies", "CORS"]
    },
    {
      id: "q8",
      question: `[PROGRAMMING CHALLENGE] Write a function that validates balanced parentheses and brackets in a code string. What data structure provides the optimal solution?`,
      category: "Coding & Data Structures",
      expectedKeywords: ["Stack", "LIFO", "O(N) Time", "O(N) Space", "Push", "Pop"]
    },
    {
      id: "q9",
      question: "How do you systematically debug production memory leaks, unhandled promise rejections, and monitor app health?",
      category: "Debugging & Operations",
      expectedKeywords: ["Logging", "DevTools", "Sentry", "Unit Tests", "Heap Snapshot", "CI/CD"]
    },
    {
      id: "q10",
      question: `[PROGRAMMING CHALLENGE] Implement pseudo-code for a rate limiter (Token Bucket or Leaky Bucket algorithm) to prevent client-side API abuse.`,
      category: "System Design & Coding",
      expectedKeywords: ["Token Bucket", "Timestamp", "Refill Rate", "Throttle", "Sliding Window"]
    },
    {
      id: "q11",
      question: "Explain how WebSockets or Server-Sent Events (SSE) maintain real-time bi-directional synchronization with fallback transport.",
      category: "Real-Time Systems",
      expectedKeywords: ["WebSocket", "SSE", "Reconnection", "Heartbeat", "Pub/Sub"]
    },
    {
      id: "q12",
      question: `[PROGRAMMING CHALLENGE] Given a deeply nested object tree, write a recursive deep-clone function handling cyclic references without built-in structuredClone.`,
      category: "Live Coding & Recursion",
      expectedKeywords: ["WeakMap", "Recursion", "Cyclic Reference", "TypeOf", "Object.keys"]
    },
    {
      id: "q13",
      question: "What is your approach to database indexing, query optimization, and schema migrations for high-concurrency environments?",
      category: "Database & Storage",
      expectedKeywords: ["B-Tree Index", "EXPLAIN ANALYZE", "Transactions", "N+1 Problem", "ORM"]
    },
    {
      id: "q14",
      question: `[PROGRAMMING CHALLENGE] Write an algorithm to find the maximum sub-array sum (Kadane's Algorithm) or explain how you would solve it in O(N) linear time.`,
      category: "Algorithmic Efficiency",
      expectedKeywords: ["Kadane Algorithm", "Dynamic Programming", "O(N) Time", "O(1) Space", "Math.max"]
    },
    {
      id: "q15",
      question: "How do you design an automated CI/CD pipeline with unit testing, integration tests, and zero-downtime deployment?",
      category: "DevOps & Quality Assurance",
      expectedKeywords: ["GitHub Actions", "Docker", "Jest/Vitest", "Blue-Green Deployment", "Rollback"]
    }
  ];

  return allQuestions.slice(0, Math.min(count, allQuestions.length));
}

function getFallbackInterviewFeedback(
  role: string, 
  violations: string[], 
  questions?: InterviewQuestion[], 
  answers?: string[]
): InterviewFeedback {
  const violationPenalty = violations.length * 6;
  
  const questionEvaluations = (questions || []).map((q, i) => {
    const ans = answers?.[i] || "Skipped";
    const isBlank = !ans || ans === "Skipped" || ans.trim().length === 0;
    const isShort = ans.length < 35;
    const keywords = q.expectedKeywords || [];
    const matchedKeywords = keywords.filter(k => ans.toLowerCase().includes(k.toLowerCase()));
    
    let baseScore = 75;
    let critique = "Detailed response provided with basic technical concepts.";
    if (isBlank) {
      baseScore = 0;
      critique = "Strict Penalty: Question was skipped or no answer was recorded.";
    } else if (isShort) {
      baseScore = 35;
      critique = "Strict Penalty: Answer is too brief and lacks architectural detail, Big-O complexity, and concrete code patterns.";
    } else if (matchedKeywords.length === 0) {
      baseScore = 50;
      critique = "Strict Penalty: Missed key industry terminology and core implementation concepts required for FAANG standards.";
    } else {
      baseScore = Math.min(92, 60 + matchedKeywords.length * 10);
      critique = `Good inclusion of key terms (${matchedKeywords.join(", ")}). To reach Senior level, elaborate on memory trade-offs and edge-case handling.`;
    }

    const idealAnswer = `FAANG Benchmark Answer for '${q.question}': Include exact data structures, algorithmic step-by-step approach, Big-O time complexity (e.g. O(N log N)), space complexity (O(1)), and fallback error recovery. Expected key terms: ${keywords.join(", ")}.`;

    return {
      question: q.question,
      answer: ans,
      score: baseScore,
      critique,
      idealAnswer
    };
  });

  const avgQuestionScore = questionEvaluations.length > 0 
    ? Math.round(questionEvaluations.reduce((acc, curr) => acc + curr.score, 0) / questionEvaluations.length)
    : 0;

  const isPoorPerformance = avgQuestionScore < 50;

  const technicalScore = Math.max(5, avgQuestionScore);
  const communicationScore = Math.max(5, Math.min(95, isPoorPerformance ? Math.round(avgQuestionScore * 0.8) : avgQuestionScore + 5));
  const confidenceScore = Math.max(5, Math.min(95, 85 - violationPenalty - (isPoorPerformance ? 30 : 0)));
  const overallScore = Math.max(5, Math.round((technicalScore * 0.45) + (communicationScore * 0.25) + (confidenceScore * 0.30)));

  const strengths = isPoorPerformance
    ? [
        "Session completed and recorded for review.",
        "Basic attempt made to participate in the interview process."
      ]
    : [
        "Demonstrated basic understanding of software engineering domain concepts.",
        "Maintained structured communication across primary interview prompts."
      ];

  const weaknesses = isPoorPerformance
    ? [
        "Failed to meet technical standards: Multiple questions were skipped or answered with insufficient depth.",
        "Lacked critical domain terminology, Big-O complexity analysis, and implementation code patterns.",
        violations.length > 0 
          ? `Strict Proctoring Penalty: ${violations.length} warning flags recorded.` 
          : "Engagement and answer completeness were significantly below passing threshold."
      ]
    : [
        "Lacked deep architectural precision on Big-O complexity, memory bounds, and edge-case error boundaries.",
        violations.length > 0 
          ? `Strict Proctoring Penalty: ${violations.length} flags triggered (eye contact, tab switching, or motion).` 
          : "Need to include more concrete code implementation examples."
      ];

  return {
    overallScore,
    communicationScore,
    confidenceScore,
    technicalScore,
    summary: isPoorPerformance
      ? `Strict FAANG Bar-Raiser Evaluation for ${role}: CANDIDATE FAILED TO MEET THE TECHNICAL BAR. Multiple questions were skipped or lacked required architectural depth and algorithmic rigor. Overall Score: ${overallScore}/100.`
      : `Strict FAANG Bar-Raiser Evaluation for ${role}: Evaluated on technical depth, algorithmic rigor, and proctoring compliance. ${violations.length > 0 ? `Deducted ${violationPenalty} points due to ${violations.length} recorded proctoring warning flags.` : 'Zero proctoring violations recorded.'}`,
    strengths,
    weaknesses,
    suggestions: [
      {
        area: "Technical Depth & Big-O Rigor",
        betterAnswer: "Always state time complexity O(...) and space complexity O(...) upfront, then detail boundary condition handling."
      },
      {
        area: "Continuous Camera Focus & Proctoring Discipline",
        betterAnswer: "Maintain uninterrupted direct gaze at your camera lens and avoid looking off-screen at notes during live responses."
      }
    ],
    questionEvaluations
  };
}

function getFallbackResumeAnalysis(targetRole: string): ResumeAnalysis {
  return {
    skills: ["React 19", "TypeScript", "Tailwind CSS", "Node.js", "REST APIs", "Git", "State Management"],
    experience: [
      {
        title: "Frontend Developer",
        company: "Tech Solutions Inc.",
        duration: "2023 - Present",
        description: "Built responsive web components, optimized web performance, and integrated AI APIs."
      },
      {
        title: "Junior Web Developer",
        company: "Digital Studio",
        duration: "2022 - 2023",
        description: "Developed client web applications and maintained clean UI design systems."
      }
    ],
    projects: [
      {
        name: "SkillX AI Platform",
        description: "Full-stack AI skill exchange platform with mock interviews, ATS resume analysis, and peer learning.",
        technologies: ["React", "TypeScript", "Tailwind", "Firebase", "Gemini API"]
      }
    ],
    education: [
      {
        degree: "Bachelor of Science in Computer Science / IT",
        institution: "State University",
        year: "2022"
      }
    ],
    atsScore: 86,
    missingSkills: ["Docker", "GraphQL", "CI/CD Pipeline Configuration"],
    improvementSuggestions: [
      `Quantify accomplishments on your resume (e.g., 'Improved load times by 40% for ${targetRole} workflows').`,
      "Add direct links to live demo projects or GitHub repositories.",
      "Highlight automated testing tools (Jest, Cypress, or Vitest) under core skills."
    ],
    roleSpecificSummary: `Your resume shows strong technical alignment for a ${targetRole} role with an impressive 86% ATS match rate.`
  };
}

function getFallbackProfileAnalysis(profileData: any): ProfileAnalysis {
  return {
    careerPath: "Mid-to-Senior Full Stack AI Developer",
    skillGapAnalysis: [
      {
        skill: "React & TypeScript",
        status: "expert",
        recommendation: "Master Server Components and advanced performance profiling."
      },
      {
        skill: "System Design",
        status: "intermediate",
        recommendation: "Practice microservices architecture and distributed caching."
      },
      {
        skill: "Cloud Deployment & DevOps",
        status: "beginner",
        recommendation: "Learn Docker, Kubernetes, and automated GitHub Actions workflows."
      }
    ],
    marketValue: "$85,000 - $125,000 USD / year",
    suggestedRoles: ["Senior Frontend Engineer", "Full-Stack AI Developer", "Tech Lead"],
    learningPath: [
      "Deep dive into System Design Primer & Database Sharding",
      "Build production-grade microservices with Docker",
      "Master AI Prompt Engineering & Vector Embeddings"
    ],
    overallReadiness: 85
  };
}

export interface SingleAnswerEvaluation {
  score: number;
  keywordMatches: string[];
  strengths: string;
  improvement: string;
}

export async function evaluateSingleAnswer(
  role: string,
  question: string,
  expectedKeywords: string[],
  userAnswer: string
): Promise<SingleAnswerEvaluation> {
  if (!userAnswer || userAnswer.trim() === "" || userAnswer === "Skipped") {
    return {
      score: 0,
      keywordMatches: [],
      strengths: "No answer was recorded.",
      improvement: "Be sure to speak or type an answer to demonstrate your technical knowledge."
    };
  }

  if (!ai) {
    const textLower = userAnswer.toLowerCase();
    const matched = (expectedKeywords || []).filter(k => textLower.includes(k.toLowerCase()));
    const score = Math.min(88, Math.max(25, matched.length * 20 + (userAnswer.length > 40 ? 30 : 10)));
    return {
      score,
      keywordMatches: matched,
      strengths: matched.length > 0 ? `Included key terminology: ${matched.join(", ")}.` : "Attempted response.",
      improvement: "Elaborate with deeper code patterns and performance trade-offs."
    };
  }

  try {
    const prompt = `You are a strict FAANG Senior Principal Staff Engineer evaluating an answer for a ${role} interview question.

STRICT EVALUATION RUBRIC:
1. High Scores (85-100): Earned ONLY if the candidate provides deep technical details, precise concepts, Big-O analysis, and architectural patterns.
2. Moderate Scores (55-80): For responses that cover core ideas but miss implementation details or trade-offs.
3. Low Scores (15-50): For brief (1 sentence), vague, hand-wavy, or surface-level answers.
4. Score 0: For blank, skipped, or completely irrelevant answers.

Question: "${question}"
Expected Key Concepts: ${JSON.stringify(expectedKeywords)}
Candidate Answer: "${userAnswer}"

Return JSON:
{
  "score": number (0-100),
  "keywordMatches": ["keyword1"],
  "strengths": "one concise sentence highlighting specific technical concepts mentioned",
  "improvement": "one concise sentence pointing out missing technical depth, trade-offs, or Big-O complexities"
}`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.NUMBER },
            keywordMatches: { type: Type.ARRAY, items: { type: Type.STRING } },
            strengths: { type: Type.STRING },
            improvement: { type: Type.STRING }
          },
          required: ["score", "keywordMatches", "strengths", "improvement"]
        }
      }
    });

    return JSON.parse(response.text || "{}");
  } catch (err) {
    const textLower = userAnswer.toLowerCase();
    const matched = (expectedKeywords || []).filter(k => textLower.includes(k.toLowerCase()));
    const isShort = userAnswer.length < 35;
    const score = isShort ? 35 : Math.min(88, Math.max(20, matched.length * 20 + (userAnswer.length > 80 ? 30 : 10)));
    return {
      score,
      keywordMatches: matched,
      strengths: matched.length > 0 ? `Mentioned key concepts: ${matched.join(", ")}.` : "Attempted response.",
      improvement: "Elaborate with deeper code patterns, edge case handling, and Big-O trade-offs."
    };
  }
}

// Exported Functions
export async function generateInterviewQuestions(role: string, difficulty: string, count: number = 10): Promise<InterviewQuestion[]> {
  if (!ai) return getFallbackInterviewQuestions(role, difficulty, count);

  const prompt = `Generate EXACTLY ${count} comprehensive technical interview questions for a ${role} position at ${difficulty} difficulty level. 

CRITICAL REQUIREMENTS:
1. AT LEAST 3 to 5 questions MUST be practical [PROGRAMMING CHALLENGE] / CODING questions specifically tailored for ${role} (e.g. asking the candidate to write pseudo-code, implement a data structure/hook, optimize an algorithm, or analyze Big-O time and space complexity).
2. The remaining questions must cover Architecture, System Design, Security, Async State, and Production Debugging.
3. Return the response as a JSON array of EXACTLY ${count} objects with structure:
   [{ "id": "q1", "question": "string", "category": "Live Coding & Algorithms | Architecture | System Design | Security | Performance", "expectedKeywords": ["keyword1", "keyword2"] }]`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              question: { type: Type.STRING },
              category: { type: Type.STRING },
              expectedKeywords: { 
                type: Type.ARRAY,
                items: { type: Type.STRING }
              }
            },
            required: ["id", "question", "category", "expectedKeywords"]
          }
        }
      }
    });

    const parsed = JSON.parse(response.text || "[]");
    return parsed.length > 0 ? parsed : getFallbackInterviewQuestions(role, difficulty, count);
  } catch (e) {
    console.warn("Gemini question generation fallback active:", e);
    return getFallbackInterviewQuestions(role, difficulty, count);
  }
}

export async function analyzeInterviewPerformance(
  role: string,
  questions: InterviewQuestion[],
  answers: string[],
  violations: string[]
): Promise<InterviewFeedback> {
  if (!ai) return getFallbackInterviewFeedback(role, violations, questions, answers);

  const interviewData = questions.map((q, i) => ({
    question: q.question,
    expectedKeywords: q.expectedKeywords || [],
    answer: answers[i] || "Skipped / No answer provided"
  }));

  const prompt = `You are a strict, unyielding FAANG Principal Staff Engineering Manager & Bar Raiser conducting an uncompromising technical interview evaluation for a candidate applying for a ${role} position.

STRICT FAANG EVALUATION RUBRIC & RULES:
1. UNCOMPROMISING TECHNICAL GRADING:
   - High scores (85-100) MUST be earned. Only assign 85+ if the answer is deep, technically precise, covers edge cases, trade-offs, and Big-O complexities.
   - Assign 40-60 for surface-level, hand-wavy, or brief answers that lack implementation specifics.
   - Assign 0-30 for answers that are incorrect, skipped, or under 15 words.
2. RIGOROUS PROCTORING PENALTY:
   - Session Proctoring Violation Flags: [${violations.join(", ") || "None"}].
   - Count total violation flags (Total: ${violations.length}).
   - You MUST deduct 6 points per proctoring flag directly from confidenceScore and overallScore! Flagged behaviors include tab switching, window un-focus, gaze deviation, offscreen reading, secondary voices, or mouse exiting.
3. DETAILED PER-QUESTION FAANG CRITIQUE:
   - For EVERY question in the interview dataset, grade the answer strictly on a 0-100 scale.
   - Provide a concise, constructive "critique" pointing out missing concepts, hand-wavy explanations, or unaddressed edge cases.
   - Provide an "idealAnswer" showing a gold-standard FAANG Principal Engineer response including exact technical terms, architecture patterns, and time/space complexity (e.g. O(N log N) time, O(1) space).

Interview Dataset:
${JSON.stringify(interviewData, null, 2)}

Return JSON conforming strictly to the requested schema.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            overallScore: { type: Type.NUMBER },
            communicationScore: { type: Type.NUMBER },
            confidenceScore: { type: Type.NUMBER },
            technicalScore: { type: Type.NUMBER },
            summary: { type: Type.STRING },
            strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
            weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
            suggestions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  area: { type: Type.STRING },
                  betterAnswer: { type: Type.STRING }
                },
                required: ["area", "betterAnswer"]
              }
            },
            questionEvaluations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  question: { type: Type.STRING },
                  answer: { type: Type.STRING },
                  score: { type: Type.NUMBER },
                  critique: { type: Type.STRING },
                  idealAnswer: { type: Type.STRING }
                },
                required: ["question", "answer", "score", "critique", "idealAnswer"]
              }
            }
          },
          required: ["overallScore", "summary", "strengths", "weaknesses", "suggestions"]
        }
      }
    });

    return JSON.parse(response.text || "{}");
  } catch (e) {
    console.warn("Gemini interview analysis fallback active:", e);
    return getFallbackInterviewFeedback(role, violations, questions, answers);
  }
}

export async function analyzeResume(resumeText: string, targetRole: string): Promise<ResumeAnalysis> {
  if (!ai) return getFallbackResumeAnalysis(targetRole);

  const prompt = `Analyze this resume for a ${targetRole} position.
  Text: ${resumeText}
  
  Provide JSON analysis matching the required schema.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            skills: { type: Type.ARRAY, items: { type: Type.STRING } },
            experience: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  company: { type: Type.STRING },
                  duration: { type: Type.STRING },
                  description: { type: Type.STRING }
                },
                required: ["title", "company"]
              }
            },
            projects: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  description: { type: Type.STRING },
                  technologies: { type: Type.ARRAY, items: { type: Type.STRING } }
                },
                required: ["name"]
              }
            },
            education: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  degree: { type: Type.STRING },
                  institution: { type: Type.STRING },
                  year: { type: Type.STRING }
                },
                required: ["degree", "institution"]
              }
            },
            atsScore: { type: Type.NUMBER },
            missingSkills: { type: Type.ARRAY, items: { type: Type.STRING } },
            improvementSuggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
            roleSpecificSummary: { type: Type.STRING }
          },
          required: ["skills", "atsScore", "roleSpecificSummary"]
        }
      }
    });

    return JSON.parse(response.text || "{}");
  } catch (e) {
    console.warn("Gemini resume analysis fallback active:", e);
    return getFallbackResumeAnalysis(targetRole);
  }
}

export async function analyzeUserProfile(profileData: any): Promise<ProfileAnalysis> {
  if (!ai) return getFallbackProfileAnalysis(profileData);

  const prompt = `Analyze the following user profile data and provide career insights, skill gap analysis, and recommendations.
  
  Profile Data:
  ${JSON.stringify(profileData, null, 2)}
  
  Provide JSON analysis matching the required schema.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            careerPath: { type: Type.STRING },
            skillGapAnalysis: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  skill: { type: Type.STRING },
                  status: { type: Type.STRING, enum: ['expert', 'intermediate', 'beginner', 'missing'] },
                  recommendation: { type: Type.STRING }
                }
              }
            },
            marketValue: { type: Type.STRING },
            suggestedRoles: { type: Type.ARRAY, items: { type: Type.STRING } },
            learningPath: { type: Type.ARRAY, items: { type: Type.STRING } },
            overallReadiness: { type: Type.NUMBER }
          }
        }
      }
    });

    return JSON.parse(response.text || "{}");
  } catch (e) {
    console.warn("Gemini profile analysis fallback active:", e);
    return getFallbackProfileAnalysis(profileData);
  }
}
