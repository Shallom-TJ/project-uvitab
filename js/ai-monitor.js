/* =========================================================
   VU NOTES — AI Academic Content Monitor (v1.0)
   Victoria University Uganda | UVTAB Curriculum Validator

   ARCHITECTURE NOTE:
   This module uses client-side keyword/topic heuristics to
   demonstrate the AI content monitoring system architecture.
   The analyzeFile() function is designed so a real AI API
   (e.g., Google Gemini) can be substituted for the
   heuristic engine later — just replace the internals of
   _analyzeText() while keeping the same public interface.

   PUBLIC API:
     AIMonitor.analyzeFile(file, selectedCourse)
       → Promise<{ status, confidence, detectedCourse, message, details }>
       status: 'approved' | 'mismatch' | 'rejected' | 'error'
   ========================================================= */

const AIMonitor = (() => {

  /* -------------------------------------------------------
     UVTAB Curriculum Knowledge Base
     Each programme maps to weighted keyword sets.
     Keywords are deliberately broad to catch summaries,
     past papers, and lecture notes — not just textbook text.
  ------------------------------------------------------- */
  const CURRICULUM_KB = {
    'Certificate in Software Engineering': {
      alias: ['Software Engineering', 'BSc Software Engineering', 'Bachelor of Science in Software Engineering'],
      keywords: [
        'software', 'engineering', 'algorithm', 'programming', 'code', 'coding',
        'object oriented', 'oop', 'class', 'function', 'method', 'variable',
        'data structure', 'linked list', 'stack', 'queue', 'tree', 'graph',
        'software development', 'sdlc', 'agile', 'scrum', 'waterfall',
        'requirements', 'design pattern', 'uml', 'use case', 'testing',
        'debugging', 'version control', 'git', 'deployment', 'maintenance',
        'java', 'python', 'javascript', 'c++', 'c#', 'php', 'html', 'css',
        'compiler', 'interpreter', 'ide', 'syntax', 'loop', 'array',
        'module', 'interface', 'inheritance', 'polymorphism', 'encapsulation'
      ]
    },
    'Certificate in Computer Science': {
      alias: ['Computer Science', 'BSc Computer Science', 'Bachelor of Science in Computer Science'],
      keywords: [
        'computer science', 'algorithm', 'complexity', 'turing', 'automata',
        'formal language', 'computation', 'binary', 'boolean', 'logic gate',
        'discrete mathematics', 'set theory', 'graph theory', 'probability',
        'machine learning', 'artificial intelligence', 'neural network',
        'data structure', 'sorting', 'searching', 'recursion', 'dynamic programming',
        'operating system', 'process', 'thread', 'memory management',
        'compiler', 'parser', 'lexer', 'grammar', 'assembly',
        'architecture', 'cpu', 'cache', 'pipeline', 'instruction set'
      ]
    },
    'Certificate in Information Technology': {
      alias: ['Information Technology', 'ICT', 'IT', 'BSc Information Technology'],
      keywords: [
        'information technology', 'ict', 'network', 'networking', 'ip address',
        'tcp', 'udp', 'dns', 'dhcp', 'router', 'switch', 'firewall',
        'hardware', 'motherboard', 'processor', 'ram', 'storage', 'peripheral',
        'operating system', 'windows', 'linux', 'mac os', 'unix',
        'database', 'sql', 'mysql', 'server', 'cloud', 'virtualisation',
        'it support', 'helpdesk', 'troubleshooting', 'installation',
        'cybersecurity', 'backup', 'recovery', 'system administration',
        'web technology', 'email', 'internet', 'intranet', 'wireless'
      ]
    },
    'Certificate in Business Computing and Data Analytics': {
      alias: ['Business Computing', 'Data Analytics', 'Business Computing and Data Analytics'],
      keywords: [
        'data analytics', 'business intelligence', 'dashboard', 'report',
        'excel', 'spreadsheet', 'pivot table', 'chart', 'visualisation',
        'statistics', 'regression', 'correlation', 'mean', 'median', 'mode',
        'database', 'query', 'sql', 'nosql', 'data warehouse', 'etl',
        'business process', 'erp', 'crm', 'decision support', 'kpi',
        'python pandas', 'r programming', 'tableau', 'power bi',
        'data mining', 'big data', 'machine learning', 'prediction'
      ]
    },
    'Certificate in Cyber Security and Digital Forensics': {
      alias: ['Cyber Security', 'Cybersecurity', 'Digital Forensics'],
      keywords: [
        'cybersecurity', 'cyber security', 'security', 'threat', 'vulnerability',
        'attack', 'hacking', 'penetration testing', 'malware', 'virus', 'ransomware',
        'phishing', 'social engineering', 'encryption', 'decryption', 'cryptography',
        'firewall', 'intrusion detection', 'ids', 'ips', 'authentication',
        'digital forensics', 'evidence', 'investigation', 'incident response',
        'risk assessment', 'compliance', 'gdpr', 'privacy', 'ethical hacking',
        'vulnerability scan', 'exploit', 'patch management', 'zero day'
      ]
    },
    'Certificate in Artificial Intelligence and Data Science': {
      alias: ['AI', 'Artificial Intelligence', 'Data Science', 'AI and Data Science'],
      keywords: [
        'artificial intelligence', 'machine learning', 'deep learning', 'neural network',
        'natural language processing', 'nlp', 'computer vision', 'image recognition',
        'supervised learning', 'unsupervised learning', 'reinforcement learning',
        'training data', 'model', 'accuracy', 'precision', 'recall', 'f1',
        'regression', 'classification', 'clustering', 'decision tree',
        'random forest', 'svm', 'gradient descent', 'backpropagation',
        'tensorflow', 'pytorch', 'scikit learn', 'keras', 'jupyter',
        'data science', 'feature engineering', 'cross validation', 'overfitting'
      ]
    },
    'Certificate in Business Administration': {
      alias: ['Business Administration', 'BBA', 'Business Admin'],
      keywords: [
        'business administration', 'management', 'organisation', 'strategy',
        'marketing', 'finance', 'accounting', 'economics', 'entrepreneurship',
        'leadership', 'human resources', 'operations', 'supply chain',
        'business plan', 'swot', 'pest', 'market research', 'consumer behaviour',
        'profit', 'loss', 'revenue', 'budget', 'investment', 'shareholders',
        'corporate governance', 'ethics', 'stakeholder', 'competitive advantage'
      ]
    },
    'Certificate in Human Resource Management': {
      alias: ['Human Resource Management', 'HRM', 'HR Management'],
      keywords: [
        'human resource', 'hr', 'hrm', 'recruitment', 'selection', 'hiring',
        'training', 'development', 'performance appraisal', 'performance management',
        'compensation', 'payroll', 'benefits', 'employee relations', 'labour law',
        'motivation', 'job analysis', 'job description', 'workforce planning',
        'talent management', 'succession planning', 'organizational culture',
        'diversity', 'inclusion', 'grievance', 'disciplinary', 'termination'
      ]
    },
    'Certificate in Journalism and Media Studies': {
      alias: ['Journalism', 'Media Studies', 'Journalism and Media'],
      keywords: [
        'journalism', 'media', 'news', 'reporting', 'broadcast', 'print media',
        'digital media', 'social media', 'press', 'editor', 'headline',
        'interview', 'investigative journalism', 'ethics', 'freedom of press',
        'media law', 'photojournalism', 'radio', 'television', 'podcast',
        'public relations', 'communication', 'audience', 'media production',
        'documentary', 'script', 'newsroom', 'editorial', 'column'
      ]
    },
    'Certificate in Nursing Science': {
      alias: ['Nursing', 'Nursing Science'],
      keywords: [
        'nursing', 'patient', 'care', 'healthcare', 'clinical', 'ward',
        'medication', 'dosage', 'injection', 'wound care', 'vital signs',
        'blood pressure', 'temperature', 'pulse', 'anatomy', 'physiology',
        'pharmacology', 'disease', 'diagnosis', 'treatment', 'hospital',
        'midwifery', 'obstetrics', 'paediatrics', 'surgery', 'emergency',
        'infection control', 'sterilisation', 'triage', 'icu', 'ward round'
      ]
    },
    'Certificate in Public Health': {
      alias: ['Public Health'],
      keywords: [
        'public health', 'epidemiology', 'community health', 'disease prevention',
        'vaccination', 'immunisation', 'health promotion', 'nutrition',
        'maternal health', 'child health', 'health policy', 'health system',
        'sanitation', 'water', 'hygiene', 'malaria', 'hiv', 'tuberculosis',
        'surveillance', 'outbreak', 'quarantine', 'health education',
        'biostatistics', 'research methods', 'qualitative', 'quantitative'
      ]
    },
    'Certificate in Social Work and Social Administration': {
      alias: ['Social Work', 'Social Administration'],
      keywords: [
        'social work', 'social welfare', 'community development', 'counselling',
        'case management', 'advocacy', 'vulnerable', 'child protection',
        'family support', 'poverty', 'inequality', 'social policy',
        'mental health', 'rehabilitation', 'probation', 'community service',
        'research', 'ethics', 'human rights', 'empowerment', 'social change'
      ]
    },
    'Certificate in Laws': {
      alias: ['Law', 'LLB', 'Legal Studies', 'Bachelor of Laws'],
      keywords: [
        'law', 'legal', 'legislation', 'statute', 'constitution', 'rights',
        'court', 'judge', 'advocate', 'plaintiff', 'defendant', 'contract',
        'tort', 'criminal law', 'civil law', 'property law', 'family law',
        'international law', 'human rights', 'evidence', 'procedure',
        'jurisdiction', 'precedent', 'appeal', 'judgment', 'injunction'
      ]
    },
    'Certificate in Tourism and Hospitality Management': {
      alias: ['Tourism', 'Hospitality', 'Tourism and Hospitality'],
      keywords: [
        'tourism', 'hospitality', 'hotel', 'travel', 'tour', 'destination',
        'accommodation', 'front office', 'housekeeping', 'food service',
        'customer service', 'reservation', 'booking', 'revenue management',
        'events management', 'catering', 'cuisine', 'heritage', 'ecotourism',
        'marketing', 'guest experience', 'concierge', 'hospitality industry'
      ]
    },
    'Certificate in Education': {
      alias: ['Education', 'Teaching', 'Certificate in Education (Arts)', 'Certificate in Education (Sciences)'],
      keywords: [
        'education', 'teaching', 'learning', 'curriculum', 'pedagogy',
        'lesson plan', 'assessment', 'evaluation', 'student', 'classroom',
        'instructional', 'methodology', 'early childhood', 'primary education',
        'secondary education', 'adult education', 'special needs', 'inclusion',
        'e-learning', 'edtech', 'mentoring', 'school management', 'discipline'
      ]
    }
  };

  /* Non-academic content signals */
  const NON_ACADEMIC_SIGNALS = [
    'download free music', 'mp3', 'mp4', 'streaming', 'watch online',
    'buy now', 'discount', 'sale', 'promo', 'advertisement', 'sponsored',
    'click here to win', 'congratulations you won', 'lottery', 'gambling',
    'dating', 'hookup', 'escort', 'adult content', 'xxx', 'porn',
    'bitcoin', 'crypto investment', 'forex signals', 'make money fast',
    'diet pill', 'weight loss pill', 'magic solution'
  ];

  /* Supported text-extractable MIME types */
  const TEXT_MIME_TYPES = [
    'text/plain', 'text/html', 'text/csv', 'text/xml',
    'application/json', 'application/xml'
  ];

  /* File types that are clearly non-academic binary files */
  const MEDIA_MIME_TYPES = [
    'image/', 'video/', 'audio/'
  ];

  /* -------------------------------------------------------
     Internal: normalize text for comparison
  ------------------------------------------------------- */
  function _normalize(text) {
    return text.toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /* -------------------------------------------------------
     Internal: score text against a course keyword list
  ------------------------------------------------------- */
  function _scoreText(normalizedText, keywords) {
    let matches = 0;
    let uniqueMatches = new Set();
    for (const kw of keywords) {
      if (normalizedText.includes(kw)) {
        uniqueMatches.add(kw);
        matches++;
      }
    }
    return { matches, uniqueMatches: uniqueMatches.size };
  }

  /* -------------------------------------------------------
     Internal: match selected course to KB entry
  ------------------------------------------------------- */
  function _findCourseEntry(selectedCourse) {
    if (!selectedCourse) return null;
    const lower = selectedCourse.toLowerCase();
    for (const [key, entry] of Object.entries(CURRICULUM_KB)) {
      if (key.toLowerCase() === lower) return { key, entry };
      if (entry.alias.some(a => lower.includes(a.toLowerCase()) || a.toLowerCase().includes(lower.split(' ').pop()))) {
        return { key, entry };
      }
    }
    // Fuzzy: check if any alias keyword appears in the selected course name
    for (const [key, entry] of Object.entries(CURRICULUM_KB)) {
      for (const kw of entry.keywords.slice(0, 5)) {
        if (lower.includes(kw)) return { key, entry };
      }
    }
    return null;
  }

  /* -------------------------------------------------------
     Internal: detect which course the content most likely
     belongs to (returns top match or null)
  ------------------------------------------------------- */
  function _detectCourse(normalizedText) {
    let topScore = 0;
    let topCourse = null;

    for (const [key, entry] of Object.entries(CURRICULUM_KB)) {
      const { uniqueMatches } = _scoreText(normalizedText, entry.keywords);
      if (uniqueMatches > topScore) {
        topScore = uniqueMatches;
        topCourse = key;
      }
    }

    return topScore >= 3 ? topCourse : null;
  }

  /* -------------------------------------------------------
     Internal: detect non-academic signals
  ------------------------------------------------------- */
  function _isNonAcademic(normalizedText) {
    const triggered = NON_ACADEMIC_SIGNALS.filter(s => normalizedText.includes(s));
    return triggered.length >= 2;
  }

  /* -------------------------------------------------------
     Internal: core text analysis engine
     This is the function that would be replaced with a
     real AI/LLM API call in a production deployment.
  ------------------------------------------------------- */
  function _analyzeText(rawText, selectedCourse) {
    const text = _normalize(rawText);

    // 1. Check for non-academic / inappropriate content
    if (_isNonAcademic(text)) {
      return {
        status: 'rejected',
        confidence: 88,
        detectedCourse: null,
        message: 'This file appears to contain non-academic or inappropriate content.',
        details: 'Promotional, entertainment, or inappropriate signals were detected. UVTAB-based academic resources only.'
      };
    }

    // 2. Detect what course the content most resembles
    const detectedCourse = _detectCourse(text);

    // 3. Match selected course to KB
    const courseEntry = _findCourseEntry(selectedCourse);

    // 4. If we can't identify any course keywords at all
    if (!detectedCourse && !courseEntry) {
      // Very short or unidentifiable text
      if (text.split(' ').length < 30) {
        return {
          status: 'rejected',
          confidence: 72,
          detectedCourse: null,
          message: 'File content is too short or not readable.',
          details: 'Please ensure you are uploading a proper academic document with readable text content.'
        };
      }
      return {
        status: 'rejected',
        confidence: 65,
        detectedCourse: null,
        message: 'This content does not appear to match any known UVTAB course material.',
        details: 'No academic course-related keywords were detected. Please upload a UVTAB-related educational resource.'
      };
    }

    // 5. If selected course has a KB entry, score it
    if (courseEntry) {
      const { uniqueMatches } = _scoreText(text, courseEntry.entry.keywords);
      const totalKeywords = courseEntry.entry.keywords.length;
      const rawConfidence = Math.min(100, Math.round((uniqueMatches / totalKeywords) * 100 * 4));

      if (uniqueMatches >= 4) {
        // Strong match to selected course
        return {
          status: 'approved',
          confidence: Math.min(97, Math.max(78, rawConfidence)),
          detectedCourse: courseEntry.key,
          message: `This content appears to be relevant to the selected UVTAB-based course.`,
          details: `${uniqueMatches} matching academic topic${uniqueMatches !== 1 ? 's' : ''} detected relevant to ${courseEntry.key}.`
        };
      }

      if (uniqueMatches >= 2) {
        // Weak match — check if another course scores better
        if (detectedCourse && detectedCourse !== courseEntry.key) {
          const { uniqueMatches: detectedMatches } = _scoreText(text, CURRICULUM_KB[detectedCourse].keywords);
          if (detectedMatches > uniqueMatches * 1.5) {
            return {
              status: 'mismatch',
              confidence: Math.min(85, Math.round((detectedMatches / CURRICULUM_KB[detectedCourse].keywords.length) * 100 * 4)),
              detectedCourse,
              message: `Content mismatch detected — this document appears to contain material related to ${detectedCourse}, but you selected ${selectedCourse}.`,
              details: `Please verify you have chosen the correct course before uploading.`
            };
          }
        }
        // Marginal match — allow but with lower confidence
        return {
          status: 'approved',
          confidence: Math.min(70, Math.max(55, rawConfidence)),
          detectedCourse: courseEntry.key,
          message: 'This content appears to be relevant to the selected UVTAB-based course.',
          details: `Some matching academic content detected for ${courseEntry.key}. Confidence is moderate — please confirm this is the correct course.`
        };
      }

      // Very low match to selected course
      if (detectedCourse && detectedCourse !== courseEntry.key) {
        return {
          status: 'mismatch',
          confidence: 80,
          detectedCourse,
          message: `Content mismatch detected — this document appears to contain ${detectedCourse} material, but you selected ${selectedCourse}.`,
          details: 'Please verify you have selected the correct course, or cancel this upload.'
        };
      }

      return {
        status: 'rejected',
        confidence: 60,
        detectedCourse: null,
        message: 'This content does not appear to match the selected UVTAB course.',
        details: `Insufficient academic content was found for ${selectedCourse}. Please upload a UVTAB-related educational resource for this course.`
      };
    }

    // 6. Selected course not in KB but content detected a known course
    if (detectedCourse) {
      return {
        status: 'approved',
        confidence: 75,
        detectedCourse,
        message: 'This content appears to be relevant to the selected UVTAB-based course.',
        details: `Academic content was detected. Content appears most similar to ${detectedCourse}.`
      };
    }

    return {
      status: 'rejected',
      confidence: 55,
      detectedCourse: null,
      message: 'This content could not be classified as a UVTAB academic resource.',
      details: 'Please upload a UVTAB-related educational resource for the selected course.'
    };
  }

  /* -------------------------------------------------------
     Internal: extract text from a file (async)
  ------------------------------------------------------- */
  async function _extractText(file) {
    const mimeType = file.type || '';

    // Reject pure media files immediately
    if (MEDIA_MIME_TYPES.some(m => mimeType.startsWith(m))) {
      throw new Error('MEDIA_FILE');
    }

    // For text-based MIME types, read directly
    if (TEXT_MIME_TYPES.some(m => mimeType === m) || mimeType === '') {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result || '');
        reader.onerror = () => resolve(''); // Don't crash on read error
        reader.readAsText(file);
      });
    }

    // For PDF, DOCX, PPTX — try to read as text (will get partial content,
    // but enough for keyword detection from plaintext layers)
    if (mimeType === 'application/pdf' ||
        mimeType === 'application/msword' ||
        mimeType.includes('officedocument') ||
        file.name.match(/\.(pdf|doc|docx|ppt|pptx|xls|xlsx|txt|csv|md)$/i)) {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = e => {
          // Extract printable ASCII text from binary content
          const buffer = e.target.result;
          const bytes = new Uint8Array(buffer);
          let extracted = '';
          for (let i = 0; i < bytes.length; i++) {
            const b = bytes[i];
            if ((b >= 32 && b < 127) || b === 10 || b === 13) {
              extracted += String.fromCharCode(b);
            }
          }
          // Clean up and return meaningful chunks
          const cleaned = extracted
            .replace(/[^\x20-\x7E\n]/g, ' ')
            .replace(/\s{3,}/g, ' ')
            .trim();
          resolve(cleaned);
        };
        reader.onerror = () => resolve('');
        reader.readAsArrayBuffer(file);
      });
    }

    // Unknown type — try text read
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result || '');
      reader.onerror = () => resolve('');
      reader.readAsText(file);
    });
  }

  /* -------------------------------------------------------
     PUBLIC: analyzeFile(file, selectedCourse)
     Returns: Promise<{ status, confidence, detectedCourse, message, details }>
  ------------------------------------------------------- */
  async function analyzeFile(file, selectedCourse) {
    if (!file) {
      return {
        status: 'error',
        confidence: 0,
        detectedCourse: null,
        message: 'No file selected.',
        details: ''
      };
    }

    // Validate file size (reject > 50 MB)
    if (file.size > 50 * 1024 * 1024) {
      return {
        status: 'rejected',
        confidence: 100,
        detectedCourse: null,
        message: 'File is too large (maximum 50 MB).',
        details: 'Please compress or split your document before uploading.'
      };
    }

    let rawText = '';
    try {
      rawText = await _extractText(file);
    } catch (e) {
      if (e.message === 'MEDIA_FILE') {
        return {
          status: 'rejected',
          confidence: 98,
          detectedCourse: null,
          message: 'This file type is not accepted. Images, audio, and video files are not academic resources.',
          details: 'Please upload a document file: PDF, DOCX, TXT, PPTX, or similar academic format.'
        };
      }
      return {
        status: 'error',
        confidence: 0,
        detectedCourse: null,
        message: 'Could not read the file content.',
        details: 'The file may be corrupted or in an unsupported format.'
      };
    }

    // If we got very little text from binary extraction, still try
    if (rawText.trim().length < 10) {
      return {
        status: 'rejected',
        confidence: 70,
        detectedCourse: null,
        message: 'No readable text content could be extracted from this file.',
        details: 'Please ensure the file is a readable document (not a scanned image-only PDF). Upload a text-based academic document.'
      };
    }

    return _analyzeText(rawText, selectedCourse);
  }

  /* -------------------------------------------------------
     PUBLIC: getCourseList()
     Returns all known UVTAB courses for UI display
  ------------------------------------------------------- */
  function getCourseList() {
    return Object.keys(CURRICULUM_KB);
  }

  return { analyzeFile, getCourseList };

})();
