/*
 * SkipXam mock data + data helpers.
 * Everything is persisted to localStorage, seeded from SEED_* on first load.
 * Plain script (no modules) so pages work when opened straight from disk.
 */
(function () {
  "use strict";

  // Bump the version whenever the data shape changes, so old saved data is re-seeded.
  const STORAGE_KEY = "skipxam.data.v7";

  // ---------------------------------------------------------------------------
  // Dates. All dates are "YYYY-MM-DD" strings in the user's local time zone
  // (toISOString() would use UTC and be a day off in India before 5:30am).
  // ---------------------------------------------------------------------------

  function toISODate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function parseDate(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  function addDays(iso, days) {
    const date = parseDate(iso);
    date.setDate(date.getDate() + days);
    return toISODate(date);
  }

  function todayISO() {
    return toISODate(new Date());
  }

  // Whole days from today to iso (negative if in the past).
  function daysUntil(iso) {
    return Math.round((parseDate(iso) - parseDate(todayISO())) / 86400000);
  }

  // Turns a list into objects with stable ids: withIds("java-fc", [...]) -> [{ id: "java-fc-1", ... }]
  function withIds(prefix, items) {
    return items.map((item, i) => ({ id: `${prefix}-${i + 1}`, ...item }));
  }

  // Topics are referenced by their 1-based position in the set's topic list.
  const topicId = (setId, n) => `${setId}-topic-${n}`;

  // cards("java", [[topicNumber, front, back], ...])
  function cards(setId, rows) {
    return withIds(`${setId}-fc`, rows.map(([topic, front, back]) => ({ topicId: topicId(setId, topic), front, back })));
  }

  // questions("java", [{ topic, question, options, answer, explanation }, ...])
  function questions(setId, rows) {
    return withIds(`${setId}-q`, rows.map(({ topic, ...q }) => ({ topicId: topicId(setId, topic), ...q })));
  }

  // notes("java", [{ topic, intro, points, formulas, remember }, ...]). Heading comes from the topic.
  // Text may use **key term** (highlighted) and `code`.
  function notes(setId, rows) {
    return rows.map(({ topic, ...section }) => ({ topicId: topicId(setId, topic), formulas: [], ...section }));
  }

  // units("java", [{ name, topics: [topicNumber, ...] }, ...]): topics grouped as in the syllabus.
  function units(setId, rows) {
    return rows.map(({ name, topics }, i) => ({ id: `${setId}-unit-${i + 1}`, name, topicIds: topics.map((n) => topicId(setId, n)) }));
  }

  // mnemonics("java", [{ topic, title, trick, explain }, ...])
  function mnemonics(setId, rows) {
    return withIds(`${setId}-mn`, rows.map(({ topic, ...m }) => ({ topicId: topicId(setId, topic), ...m })));
  }

  // diagrams("java", [{ topic, title, labels }, ...]). Images are placeholders for now.
  function diagrams(setId, rows) {
    return withIds(`${setId}-dg`, rows.map(({ topic, ...d }) => ({ topicId: topicId(setId, topic), ...d })));
  }

  // written("java", [{ topic, question, marks, keyPoints, modelAnswer }, ...])
  // For the university-paper practice test. Answers are mock-marked by how many
  // keyPoints (short terms, matched case-insensitively) they mention.
  function written(setId, rows) {
    return withIds(`${setId}-w`, rows.map(({ topic, ...w }) => ({ topicId: topicId(setId, topic), ...w })));
  }

  // ---------------------------------------------------------------------------
  // Seed data
  //
  // Exam dates, study plan days and "last opened" times are written relative to
  // the day the data is first seeded (examInDays, day, openedHoursAgo), so the
  // demo always has tasks for today. seed() turns them into real dates.
  // Study plan `tool` is the tool page the task opens: flashcards | quiz | notes.
  // ---------------------------------------------------------------------------

  const SEED_USER = {
    name: "Samrat",
    email: "samrat@example.com",
    college: "City Engineering College",
    course: "B.E. Computer Science",
    year: 2,
    avatar: null, // a small data: URL once the user uploads a picture
    streak: 7,
    plan: "free", // "free" | "pro" | "max"
    billing: "monthly", // "monthly" | "yearly"
    planRenews: null, // renewal date for paid plans
    referral: { code: "SAMRAT7", joined: 2 },
    settings: { dailyGoal: 60, notifications: true, theme: "dark" },
    stats: { flashcardsReviewed: 412, quizzesTaken: 23, quizScoreTotal: 1656 }, // average = total / taken
    history: {}, // { "YYYY-MM-DD": minutes } for past days; seed() fills 16 weeks
    calendarConnected: false, // mock Google Calendar connection
    reminders: { enabled: true, time: "18:00", days: [1, 2, 3, 4, 5] }, // days: 0 = Sunday
    studyToday: { date: null, minutes: 50 }, // seed() sets the date; the shell adds a minute per minute studied
    dismissed: {}, // hints the user has closed, e.g. { planHowItWorks: true }
  };

  const javaSet = {
    id: "java",
    name: "Java",
    emoji: "☕",
    colour: "#E0673A",
    subject: "Object Oriented Programming with Java",
    examInDays: 12,
    folderId: "semester-3",
    createdAt: "2026-10-05",
    openedHoursAgo: 2,
    lastActivity: { tool: "flashcards", position: 12, total: 23 },
    files: withIds("java-file", [
      { name: "Java_Unit1_OOP.pdf", type: "pdf", date: "2026-10-05" },
      { name: "Exception_Handling_handwritten.jpg", type: "image", date: "2026-10-09" },
      { name: "Collections_Notes.docx", type: "docx", date: "2026-10-14" },
    ]),
    topics: withIds("java-topic", [
      { name: "OOP Concepts", mastery: 78 },
      { name: "Strings & StringBuilder", mastery: 70 },
      { name: "Exception Handling", mastery: 62 },
      { name: "JVM Architecture", mastery: 55 },
      { name: "Collections Framework", mastery: 45 },
      { name: "Multithreading", mastery: 28 },
    ]),
    flashcards: cards("java", [
      [4, "What is the JVM?", "The Java Virtual Machine. It executes compiled bytecode, which is what makes Java platform independent: \"write once, run anywhere\"."],
      [4, "JDK vs JRE", "JRE = JVM + core libraries (enough to run programs). JDK = JRE + development tools such as javac and jdb (needed to write and compile programs)."],
      [4, "What is bytecode?", "The platform-independent intermediate code (.class files) that javac produces and the JVM executes."],
      [1, "Encapsulation", "Bundling data and the methods that act on it into one class, and hiding the data behind private fields with public getters/setters."],
      [1, "Inheritance", "A subclass acquires the fields and methods of a superclass using `extends`. Java allows single inheritance of classes, but a class can implement many interfaces."],
      [1, "Two types of polymorphism", "Compile-time (method overloading) and runtime (method overriding, resolved through dynamic method dispatch)."],
      [1, "Abstract class vs interface", "An abstract class can have state, constructors and concrete methods, and a class can extend only one. An interface defines a contract; a class can implement many."],
      [1, "Three uses of `final`", "final variable = constant, final method = cannot be overridden, final class = cannot be extended."],
      [1, "What does `static` mean?", "The member belongs to the class rather than to any one object, so it is shared by all instances and can be accessed without creating one."],
      [1, "What is a constructor?", "A special method with the same name as the class and no return type, called automatically with `new` to initialise an object."],
      [1, "`this` vs `super`", "`this` refers to the current object. `super` refers to the parent class and is used to call its constructor or overridden methods."],
      [3, "Checked vs unchecked exceptions", "Checked exceptions (e.g. IOException) must be caught or declared with `throws`. Unchecked exceptions (RuntimeException subclasses, e.g. NullPointerException) need not be."],
      [3, "When does `finally` run?", "Always after try/catch, whether or not an exception was thrown. The exception is if the JVM exits first, e.g. System.exit()."],
      [2, "Why are Strings immutable?", "A String object's value cannot change after creation; \"modifying\" one creates a new object. This allows string pooling and thread safety. Use StringBuilder for repeated edits."],
      [5, "ArrayList vs LinkedList", "ArrayList is backed by a dynamic array: fast random access, slower inserts in the middle. LinkedList is a doubly linked list: fast inserts/removals at the ends, slow random access."],
      [5, "HashMap key facts", "Stores key-value pairs, allows one null key and many null values, does not keep insertion order, and is not synchronized."],
      [6, "Two ways to create a thread", "Extend the Thread class, or implement Runnable and pass it to a Thread. Either way, call start() (not run()) to begin a new thread."],
      [4, "What is garbage collection?", "The JVM's automatic reclaiming of memory used by objects that are no longer reachable. You can request it with System.gc() but cannot force it."],
      [2, "What is the string pool?", "A special area of the heap where String literals are stored once and shared, so identical literals point to the same object."],
      [2, "equals() vs == for Strings", "equals() compares the characters; == compares whether both references point to the same object."],
      [3, "throw vs throws", "`throw` raises an exception inside a method. `throws` in a method signature declares the exceptions it may pass to the caller."],
      [6, "What does `synchronized` do?", "Lets only one thread at a time execute the block or method on the same object, preventing race conditions."],
      [6, "Thread lifecycle states", "New, Runnable, Blocked, Waiting, Timed Waiting and Terminated."],
    ]),
    quiz: questions("java", [
      { topic: 2, question: "Which of these is NOT a primitive data type in Java?", options: ["int", "boolean", "String", "char"], answer: 2, explanation: "String is a class in java.lang. The eight primitives are byte, short, int, long, float, double, char and boolean." },
      { topic: 4, question: "What is the size of an int in Java?", options: ["16 bits", "32 bits", "64 bits", "Depends on the platform"], answer: 1, explanation: "Java fixes int at 32 bits on every platform. That is part of its platform independence." },
      { topic: 1, question: "Which keyword is used to inherit from a class?", options: ["implements", "extends", "inherits", "super"], answer: 1, explanation: "`extends` inherits from a class; `implements` is for interfaces." },
      { topic: 1, question: "What is the default value of a boolean instance variable?", options: ["true", "false", "null", "0"], answer: 1, explanation: "Instance variables get default values. For boolean that is false. Local variables get no default and must be initialised." },
      { topic: 4, question: "Which is the correct signature of the main method?", options: ["public void main(String args)", "static void main()", "public static void main(String[] args)", "public static int main(String[] args)"], answer: 2, explanation: "The JVM looks for a public static void method named main that takes a String array." },
      { topic: 1, question: "Which kind of method cannot be overridden?", options: ["public method", "protected method", "final method", "abstract method"], answer: 2, explanation: "A final method cannot be overridden. Abstract methods must be overridden by concrete subclasses." },
      { topic: 3, question: "Which of these is a checked exception?", options: ["NullPointerException", "ArithmeticException", "IOException", "ArrayIndexOutOfBoundsException"], answer: 2, explanation: "IOException must be caught or declared. The other three extend RuntimeException, so they are unchecked." },
      { topic: 2, question: "For two objects a and b, what does `a == b` compare?", options: ["Their contents", "Their references", "Their hash codes", "Their class names"], answer: 1, explanation: "== checks whether both variables point to the same object. Use equals() to compare contents." },
      { topic: 5, question: "Which collection does NOT allow duplicate elements?", options: ["List", "ArrayList", "Set", "Vector"], answer: 2, explanation: "A Set stores unique elements only. List, ArrayList and Vector all allow duplicates." },
      { topic: 2, question: "What does `System.out.println(\"5\" + 3 + 2);` print?", options: ["10", "532", "55", "Compilation error"], answer: 1, explanation: "Evaluation is left to right. \"5\" + 3 becomes the String \"53\", then + 2 gives \"532\"." },
      { topic: 1, question: "Which keyword stops a class from being subclassed?", options: ["static", "private", "final", "abstract"], answer: 2, explanation: "A final class cannot be extended. String is a well-known example." },
      { topic: 1, question: "Before Java 8, interface methods were implicitly:", options: ["private", "public and abstract", "static", "protected"], answer: 1, explanation: "Before Java 8 every interface method was implicitly public and abstract. Java 8 added default and static methods." },
      { topic: 4, question: "Which package is imported automatically into every Java program?", options: ["java.util", "java.io", "java.lang", "java.net"], answer: 2, explanation: "java.lang (String, Math, System, Object, ...) is always available without an import." },
      { topic: 1, question: "Method overloading is an example of:", options: ["Runtime polymorphism", "Compile-time polymorphism", "Encapsulation", "Abstraction"], answer: 1, explanation: "The compiler picks the overloaded method from the argument types, so it is resolved at compile time." },
      { topic: 6, question: "Which statement correctly starts a new thread from a Runnable r?", options: ["r.run();", "new Thread(r).run();", "new Thread(r).start();", "Thread.start(r);"], answer: 2, explanation: "start() creates a new thread that then calls run(). Calling run() directly runs it on the current thread." },
      { topic: 2, question: "Which class should you use to build a string inside a loop efficiently?", options: ["String", "StringBuilder", "Character", "Object"], answer: 1, explanation: "StringBuilder is mutable, so appending doesn't create a new object each time the way String concatenation does." },
      {"topic": 3, "question": "When does a `finally` block NOT run?", "options": ["When an exception is thrown", "When no exception is thrown", "When System.exit() is called in try", "When catch rethrows the exception"], "answer": 2, "explanation": "finally runs on every normal and exceptional path. Only stopping the JVM first, e.g. with System.exit(), skips it."},
      {"topic": 3, "question": "Which keyword declares that a method may pass an exception to its caller?", "options": ["throw", "throws", "try", "catch"], "answer": 1, "explanation": "`throws` goes in the method signature. `throw` actually raises an exception."},
      {"topic": 5, "question": "How many null keys can a HashMap hold?", "options": ["None", "One", "Two", "Unlimited"], "answer": 1, "explanation": "Keys are unique, so a HashMap allows exactly one null key. It allows any number of null values."},
      {"topic": 5, "question": "Which list gives the fastest access by index?", "options": ["LinkedList", "ArrayList", "Both are equal", "Neither supports index access"], "answer": 1, "explanation": "ArrayList is backed by an array, so get(i) is O(1). LinkedList has to walk the nodes, which is O(n)."},
      {"topic": 6, "question": "What is the main purpose of the `synchronized` keyword?", "options": ["To make code run faster", "To start a new thread", "To let only one thread at a time run a block on the same object", "To pause a thread"], "answer": 2, "explanation": "synchronized acquires the object's lock, so other threads wait. That prevents race conditions on shared data."},
      {"topic": 6, "question": "Which method pauses the current thread for a given time?", "options": ["Thread.wait(ms)", "Thread.sleep(ms)", "Thread.stop(ms)", "Thread.yield(ms)"], "answer": 1, "explanation": "Thread.sleep(ms) pauses the current thread. wait() is an Object method used with locks, and yield() takes no time argument."},
    ]),
    notes: notes("java", [
      {"topic": 1, "intro": "Java is built around **classes** and **objects**. Four pillars shape how classes are designed.", "points": ["**Encapsulation**: keep fields `private` and expose them through getters and setters.", "**Inheritance**: a subclass `extends` one superclass and reuses its members. A class can implement many interfaces.", "**Polymorphism**: overloading is resolved at compile time; overriding at runtime through dynamic method dispatch.", "**Abstraction**: abstract classes and interfaces define what an object does, not how."], "remember": "`final` blocks change: a final variable can't be reassigned, a final method can't be overridden, and a final class can't be extended."},
      {"topic": 2, "intro": "A `String` is **immutable**: every \"change\" creates a new String object.", "points": ["String literals are stored once in the **string pool** and shared.", "Use `equals()` to compare contents; `==` only checks whether two references point to the same object.", "**StringBuilder** is mutable and fast for building strings in loops. StringBuffer is its synchronized, slower cousin."], "remember": "`\"5\" + 3 + 2` is \"532\": once a String appears, + means concatenation, evaluated left to right."},
      {"topic": 3, "intro": "Every exception is a subclass of **Throwable**, which splits into **Error** (serious, not caught) and **Exception**.", "points": ["**Checked** exceptions (e.g. IOException) must be caught or declared with `throws`.", "**Unchecked** exceptions extend RuntimeException (e.g. NullPointerException) and need not be declared.", "`try` holds risky code, `catch` handles it, and `finally` runs whether or not an exception occurred.", "`throw` raises an exception; `throws` declares that a method might pass one on."], "remember": "finally always runs, except when the JVM exits first with System.exit()."},
      {"topic": 4, "intro": "`javac` compiles source code into **bytecode** (.class files), which the **JVM** runs on any platform.", "points": ["**JDK** = JRE + development tools (javac, jdb). **JRE** = JVM + core libraries.", "The **class loader** loads classes; the **execution engine** runs bytecode, and the **JIT compiler** turns hot code into native code.", "Objects live on the **heap**; method calls and local variables live on the **stack**.", "**Garbage collection** reclaims memory from objects that are no longer reachable."], "remember": "Write once, run anywhere: the bytecode is the same everywhere; only the JVM is platform-specific."},
      {"topic": 5, "intro": "The Collections Framework gives ready-made data structures under three main interfaces.", "points": ["**List**: ordered and allows duplicates (ArrayList, LinkedList).", "**Set**: no duplicates (HashSet, TreeSet).", "**Map**: key-value pairs (HashMap, TreeMap). It is not a subtype of Collection.", "ArrayList gives fast random access; LinkedList gives fast inserts and removals at the ends."], "remember": "HashMap allows one null key and many null values, keeps no order, and is not synchronized."},
      {"topic": 6, "intro": "A **thread** is an independent path of execution inside a program.", "points": ["Create one by extending **Thread** or implementing **Runnable**, then call `start()`.", "Thread states: New, Runnable, Blocked, Waiting, Timed Waiting, Terminated.", "`synchronized` lets only one thread at a time run a block on the same object, preventing **race conditions**.", "`Thread.sleep(ms)` pauses the current thread without releasing its locks."], "remember": "Calling run() directly runs the code on the current thread. Only start() creates a new one."},
    ]),
    units: units("java", [
      { name: "Java Programming Fundamentals and OOP", topics: [1, 2, 4] },
      { name: "Exceptions, Collections and Concurrency", topics: [3, 5, 6] },
    ]),
    currentTopicId: null,
    planMode: "standard",
    planSort: "recommended",
    mnemonics: mnemonics("java", [
      {"topic": 1, "title": "A PIE", "trick": "The four pillars of OOP spell A PIE.", "explain": "**A**bstraction, **P**olymorphism, **I**nheritance, **E**ncapsulation."},
      {"topic": 2, "title": "Stone vs builder", "trick": "Strings are set in stone; builders build.", "explain": "A String can never change, so each edit makes a new one. StringBuilder edits in place."},
      {"topic": 3, "title": "Checked = Compiler checks", "trick": "Checked exceptions are checked by the Compiler. Unchecked ones are Runtime surprises.", "explain": "Checked (IOException) must be caught or declared; unchecked extend RuntimeException."},
      {"topic": 4, "title": "Kit ⊃ Runtime ⊃ Machine", "trick": "The Kit holds the Runtime, which holds the Machine.", "explain": "JDK ⊃ JRE ⊃ JVM. You develop with the JDK, run with the JRE, and the JVM executes bytecode."},
      {"topic": 5, "title": "Line, Single, Match", "trick": "List keeps a Line, Set keeps Singles, Map keeps Matches.", "explain": "List: ordered with duplicates. Set: unique items. Map: key → value pairs."},
      {"topic": 6, "title": "start() starts, run() just runs", "trick": "Only start() starts a new thread; run() just runs the code where you are.", "explain": "Calling run() directly executes on the current thread, with no concurrency."},
    ]),
    diagrams: diagrams("java", [
      {"topic": 4, "title": "JVM architecture", "labels": ["Class loader", "Method area", "Heap", "Stack", "Execution engine", "JIT compiler"]},
      {"topic": 6, "title": "Thread life cycle", "labels": ["New", "Runnable", "Blocked", "Waiting", "Terminated"]},
      {"topic": 5, "title": "Collections hierarchy", "labels": ["Collection", "List", "Set", "Queue", "Map"]},
    ]),
    recordings: [],
    written: written("java", [
      {"topic": 1, "marks": 5, "question": "Explain encapsulation with an example.", "keyPoints": ["private", "getter", "setter", "data hiding", "class"], "modelAnswer": "Encapsulation bundles data and the methods that use it inside a class and hides the data. Fields are private and accessed through public getters and setters, e.g. a BankAccount with a private balance and deposit()/getBalance()."},
      {"topic": 3, "marks": 5, "question": "Differentiate between checked and unchecked exceptions.", "keyPoints": ["compile", "RuntimeException", "IOException", "throws", "NullPointerException"], "modelAnswer": "Checked exceptions are checked at compile time and must be caught or declared with throws (e.g. IOException). Unchecked exceptions extend RuntimeException, aren't checked at compile time and needn't be declared (e.g. NullPointerException)."},
      {"topic": 4, "marks": 5, "question": "Explain the difference between JDK, JRE and JVM.", "keyPoints": ["bytecode", "javac", "libraries", "development", "platform"], "modelAnswer": "The JVM runs bytecode and makes Java platform independent. The JRE is the JVM plus core libraries, enough to run programs. The JDK is the JRE plus development tools such as javac."},
      {"topic": 2, "marks": 5, "question": "Why are Strings immutable in Java? When should you use StringBuilder?", "keyPoints": ["immutable", "string pool", "thread", "new object", "StringBuilder"], "modelAnswer": "Strings can't change after creation, which allows the string pool to share literals safely and makes them thread-safe. Each modification creates a new object, so StringBuilder (mutable) should be used when building strings in loops."},
      {"topic": 5, "marks": 5, "question": "Compare ArrayList and LinkedList.", "keyPoints": ["array", "doubly", "random access", "insert", "index"], "modelAnswer": "ArrayList uses a dynamic array: fast random access by index but slow inserts in the middle. LinkedList is a doubly linked list: fast inserts and removals at the ends but slow access by index."},
      {"topic": 1, "marks": 10, "question": "Explain polymorphism in Java. Distinguish method overloading from method overriding with examples.", "keyPoints": ["overloading", "overriding", "compile", "runtime", "dynamic method dispatch", "parameters", "signature", "superclass"], "modelAnswer": "Polymorphism lets one interface have many forms. Overloading: same method name, different parameters, resolved at compile time. Overriding: a subclass redefines a superclass method with the same signature, resolved at runtime through dynamic method dispatch."},
      {"topic": 6, "marks": 10, "question": "Explain two ways of creating threads in Java and describe the thread life cycle.", "keyPoints": ["Thread", "Runnable", "start", "run", "new", "blocked", "waiting", "terminated"], "modelAnswer": "Extend Thread and override run(), or implement Runnable and pass it to a Thread; call start() in both cases. Life cycle: New → Runnable → (Blocked / Waiting / Timed Waiting) → Terminated."},
      {"topic": 3, "marks": 10, "question": "Explain exception handling in Java using try, catch, finally, throw and throws, with an example.", "keyPoints": ["try", "catch", "finally", "throw", "throws", "Throwable", "exception"], "modelAnswer": "Risky code goes in try; catch handles specific exceptions; finally always runs for clean-up. throw raises an exception object; throws declares exceptions a method may pass on. All exceptions descend from Throwable."},
    ]),
    studyPlan: withIds("java-task", [
      { day: -2, title: "Review 10 OOP flashcards", tool: "flashcards", done: true },
      { day: -2, title: "Quiz: OOP Concepts", tool: "quiz", done: true },
      { day: -1, title: "Read Exception Handling notes", tool: "notes", done: true },
      { day: 0, title: "Quiz: Exception Handling", tool: "quiz", done: true },
      { day: 0, title: "Review 15 flashcards", tool: "flashcards", done: false },
      { day: 1, title: "Read Collections Framework notes", tool: "notes", done: false },
      { day: 3, title: "Review Strings & StringBuilder flashcards", tool: "flashcards", done: false },
      { day: 4, title: "Quiz: Multithreading", tool: "quiz", done: false },
      { day: 6, title: "Mixed revision quiz", tool: "quiz", done: false },
    ]),
  };

  const thermoSet = {
    id: "thermo",
    name: "Engineering Thermodynamics",
    emoji: "🔥",
    colour: "#4FA3D9",
    subject: "Mechanical Engineering",
    examInDays: 20,
    folderId: null,
    createdAt: "2026-10-08",
    openedHoursAgo: 26,
    lastActivity: { tool: "notes", position: 2, total: 6 },
    files: withIds("thermo-file", [
      { name: "Thermo_Module1_Basics.pdf", type: "pdf", date: "2026-10-08" },
      { name: "First_Law_Solved_Problems.pdf", type: "pdf", date: "2026-10-12" },
      { name: "Second_Law_Lecture.pptx", type: "pptx", date: "2026-10-17" },
    ]),
    topics: withIds("thermo-topic", [
      { name: "Basic Concepts & Zeroth Law", mastery: 82 },
      { name: "First Law of Thermodynamics", mastery: 66 },
      { name: "Carnot Cycle & Heat Engines", mastery: 58 },
      { name: "Second Law & Entropy", mastery: 41 },
      { name: "Properties of Pure Substances", mastery: 35 },
      { name: "Gas Power Cycles", mastery: 22 },
    ]),
    flashcards: cards("thermo", [
      [1, "System, surroundings and boundary", "The system is the quantity of matter or region being studied, the surroundings are everything outside it, and the boundary separates the two. The boundary can be fixed or movable."],
      [1, "Closed vs open vs isolated system", "Closed: energy crosses the boundary but mass does not. Open (control volume): both mass and energy cross. Isolated: neither mass nor energy crosses."],
      [1, "Zeroth law", "If A and B are each in thermal equilibrium with C, then A and B are in thermal equilibrium with each other. It is the basis of temperature measurement."],
      [2, "First law for a closed system", "Q − W = ΔU, where Q is heat added to the system and W is work done by the system. It is the law of conservation of energy."],
      [2, "Enthalpy", "H = U + PV. Useful for flow processes; in a constant-pressure process the heat transferred equals the change in enthalpy."],
      [4, "Kelvin–Planck statement", "No cyclic device can produce net work while exchanging heat with only one reservoir. In other words, no heat engine is 100% efficient."],
      [4, "Clausius statement", "Heat cannot flow from a colder body to a hotter body on its own; external work is required, as in a refrigerator."],
      [4, "Definition of entropy", "dS = δQ_rev / T. It measures molecular disorder. The entropy of an isolated system never decreases."],
      [3, "Carnot efficiency", "η = 1 − T_L / T_H, with temperatures in kelvin. No engine working between the same two reservoirs can be more efficient."],
      [3, "COP of refrigerator and heat pump", "COP_R = Q_L / W, COP_HP = Q_H / W. Between the same temperatures, COP_HP = COP_R + 1."],
      [1, "Intensive vs extensive property", "Intensive properties don't depend on mass (temperature, pressure, density). Extensive properties do (mass, volume, total energy)."],
      [1, "Quasi-static process", "A process carried out so slowly that the system is effectively in equilibrium at every instant. It is an idealisation used to define reversible work."],
      [2, "Isothermal work, ideal gas", "W = P₁V₁ ln(V₂/V₁) = mRT ln(V₂/V₁)."],
      [2, "Reversible adiabatic process, ideal gas", "PV^γ = constant, where γ = cp/cv. No heat is transferred and entropy stays constant (isentropic)."],
      [2, "Steady flow energy equation (per kg)", "h₁ + V₁²/2 + gz₁ + q = h₂ + V₂²/2 + gz₂ + w."],
      [6, "Otto cycle efficiency", "η = 1 − 1 / r^(γ−1), where r is the compression ratio. Efficiency rises as r increases."],
      [5, "Dryness fraction (x)", "Mass of dry vapour ÷ total mass of wet steam. x = 0 for saturated liquid, x = 1 for dry saturated vapour."],
      [5, "Triple point", "The state where the solid, liquid and vapour phases coexist in equilibrium. For water: 0.01 °C and 0.6117 kPa."],
      [5, "Critical point", "The state above which liquid and vapour can't be told apart, and latent heat of vaporisation is zero. For water: 373.95 °C and 22.06 MPa."],
      [5, "Superheated steam", "Steam heated above its saturation temperature at a given pressure. It behaves more like an ideal gas."],
      [6, "Compression ratio (r)", "Total cylinder volume ÷ clearance volume: r = V_max / V_min."],
      [6, "Diesel cycle", "Air-standard cycle for CI engines: isentropic compression, constant-pressure heat addition, isentropic expansion, constant-volume heat rejection."],
      [6, "Air-standard assumptions", "The working fluid is air as an ideal gas, combustion becomes heat addition, exhaust becomes heat rejection, and all processes are reversible."],
    ]),
    quiz: questions("thermo", [
      { topic: 1, question: "Which of these is an intensive property?", options: ["Mass", "Volume", "Temperature", "Total energy"], answer: 2, explanation: "Temperature doesn't depend on the amount of matter. Mass, volume and total energy scale with system size." },
      { topic: 1, question: "The zeroth law of thermodynamics is the basis for:", options: ["Conservation of energy", "Temperature measurement", "Entropy", "Heat engine efficiency"], answer: 1, explanation: "It defines thermal equilibrium, which is what lets a thermometer measure temperature." },
      { topic: 1, question: "A system that exchanges neither mass nor energy with its surroundings is:", options: ["Open", "Closed", "Isolated", "Adiabatic"], answer: 2, explanation: "An isolated system has no mass or energy interaction. An adiabatic system only blocks heat." },
      { topic: 3, question: "A Carnot engine works between 500 K and 300 K. Its efficiency is:", options: ["25%", "40%", "60%", "66.7%"], answer: 1, explanation: "η = 1 − 300/500 = 0.4, which is 40%." },
      { topic: 2, question: "Work done in a constant-volume process is:", options: ["Maximum", "Zero", "Negative", "Equal to heat transferred"], answer: 1, explanation: "Boundary work is ∫P dV, and dV = 0, so W = 0. Note that Q = ΔU here, which is why option 4 is a trap." },
      { topic: 4, question: "During an irreversible process, the entropy of an isolated system:", options: ["Decreases", "Stays constant", "Increases", "Becomes zero"], answer: 2, explanation: "By the increase-of-entropy principle, it increases for irreversible processes and stays constant only for reversible ones." },
      { topic: 2, question: "In a throttling process, which property remains constant?", options: ["Pressure", "Temperature", "Enthalpy", "Entropy"], answer: 2, explanation: "Throttling has no work, negligible heat transfer and negligible change in kinetic energy, so h₁ = h₂." },
      { topic: 4, question: "The Kelvin–Planck statement is a form of:", options: ["Zeroth law", "First law", "Second law", "Third law"], answer: 2, explanation: "Kelvin–Planck and Clausius are the two classical statements of the second law." },
      { topic: 3, question: "Between the same two temperatures, COP of a heat pump equals:", options: ["COP_R − 1", "COP_R", "COP_R + 1", "1 / COP_R"], answer: 2, explanation: "Q_H = Q_L + W, so Q_H/W = Q_L/W + 1." },
      { topic: 2, question: "For a reversible adiabatic process of an ideal gas:", options: ["PV = constant", "PV^γ = constant", "P/T = constant", "V/T = constant"], answer: 1, explanation: "PV = constant is isothermal. A reversible adiabatic process follows PV^γ = constant." },
      { topic: 6, question: "The air-standard efficiency of the Otto cycle depends on:", options: ["Compression ratio", "Cut-off ratio", "Heat supplied", "Engine speed"], answer: 0, explanation: "η = 1 − 1/r^(γ−1), so for a given gas it depends only on the compression ratio r. Cut-off ratio matters in the Diesel cycle." },
      { topic: 4, question: "The SI unit of entropy is:", options: ["J", "J/K", "W/K", "K/J"], answer: 1, explanation: "From dS = δQ/T, entropy is joules per kelvin. Specific entropy is J/(kg·K)." },
      { topic: 2, question: "For a closed system undergoing a cycle, the first law gives:", options: ["∮δQ = 0", "∮δW = 0", "∮δQ = ∮δW", "ΔU > 0"], answer: 2, explanation: "Over a full cycle ΔU = 0, so net heat equals net work." },
      { topic: 5, question: "The dryness fraction of dry saturated vapour is:", options: ["0", "0.5", "1", "Undefined"], answer: 2, explanation: "Dry saturated vapour has no liquid, so x = 1. Saturated liquid has x = 0." },
      { topic: 1, question: "Which of these is a path function?", options: ["Pressure", "Temperature", "Work", "Internal energy"], answer: 2, explanation: "Work and heat depend on the path taken. The others are properties (point functions)." },
      { topic: 2, question: "The internal energy of an ideal gas depends only on its:", options: ["Pressure", "Volume", "Temperature", "Entropy"], answer: 2, explanation: "This is Joule's law: for an ideal gas, U = U(T)." },
      {"topic": 5, "question": "At the critical point, the latent heat of vaporisation is:", "options": ["Maximum", "Zero", "Equal to sensible heat", "Undefined"], "answer": 1, "explanation": "At the critical point liquid and vapour have identical properties, so no latent heat is needed to change phase."},
      {"topic": 5, "question": "Wet steam with dryness fraction 0.8 contains:", "options": ["80% liquid by mass", "80% dry vapour by mass", "80% vapour by volume", "20% vapour by mass"], "answer": 1, "explanation": "x is the mass fraction of dry vapour, so 0.8 means 80% vapour and 20% liquid by mass."},
      {"topic": 6, "question": "In the Otto cycle, heat is added at constant:", "options": ["Pressure", "Temperature", "Volume", "Entropy"], "answer": 2, "explanation": "Otto heat addition is at constant volume (spark ignition). The Diesel cycle adds heat at constant pressure."},
      {"topic": 6, "question": "For the same compression ratio and heat input, which cycle is more efficient?", "options": ["Diesel cycle", "Otto cycle", "Both are equal", "Depends only on the fuel"], "answer": 1, "explanation": "With equal compression ratio and heat input, Otto is more efficient. Diesel engines win in practice because they run at much higher compression ratios."},
      {"topic": 3, "question": "The efficiency of a reversible engine between two reservoirs depends on:", "options": ["The working fluid", "Only the reservoir temperatures", "The engine size", "The speed of the cycle"], "answer": 1, "explanation": "By the Carnot principles, every reversible engine between the same two reservoirs has η = 1 − T_L/T_H, whatever the working fluid."},
    ]),
    notes: notes("thermo", [
      {"topic": 1, "intro": "Thermodynamics studies energy and how it changes form. Every problem starts by defining the **system**.", "points": ["**Closed** system: energy crosses the boundary, mass doesn't. **Open** system (control volume): both cross. **Isolated**: neither.", "**Intensive** properties don't depend on mass (T, P, density); **extensive** ones do (mass, V, E).", "A **quasi-static** process is slow enough to stay in equilibrium at every step.", "**Path functions** (work, heat) depend on the process; **point functions** (properties) depend only on the state."], "remember": "Zeroth law: if A and B are each in thermal equilibrium with C, they're in equilibrium with each other. It is the basis of temperature measurement."},
      {"topic": 2, "intro": "The first law is **conservation of energy**: energy changes form but is never created or destroyed.", "points": ["For a cycle, net heat equals net work.", "**Enthalpy** H = U + PV is convenient for flow processes.", "Boundary work is zero at constant volume. For an ideal gas, internal energy depends only on temperature.", "In **throttling**, enthalpy stays constant."], "formulas": [{"label": "Closed system", "expr": "Q − W = ΔU"}, {"label": "Isothermal work, ideal gas", "expr": "W = P₁V₁ ln(V₂/V₁)"}, {"label": "Steady flow energy equation (per kg)", "expr": "h₁ + V₁²/2 + gz₁ + q = h₂ + V₂²/2 + gz₂ + w"}], "remember": "Sign convention: heat added to the system and work done by the system are positive."},
      {"topic": 3, "intro": "A **heat engine** takes heat from a hot reservoir, turns part of it into work, and rejects the rest to a cold reservoir.", "points": ["The **Carnot cycle** has two reversible isothermal and two reversible adiabatic processes.", "No engine between the same two reservoirs can beat Carnot efficiency, and every reversible engine between them has the same efficiency.", "Refrigerators and heat pumps run the cycle in reverse and are rated by **COP**."], "formulas": [{"label": "Carnot efficiency", "expr": "η = 1 − T_L / T_H"}, {"label": "Coefficient of performance", "expr": "COP_R = Q_L / W     COP_HP = Q_H / W = COP_R + 1"}], "remember": "Always use kelvin: 500 K and 300 K give 40%. Plugging in 227 °C and 27 °C directly would give a wrong 88%."},
      {"topic": 4, "intro": "The second law says which way processes go: heat flows from hot to cold, and some energy is always rejected.", "points": ["**Kelvin–Planck**: no cyclic device can turn all the heat from a single reservoir into work.", "**Clausius**: heat can't flow from cold to hot without external work. The two statements are equivalent.", "**Entropy** measures disorder. In an isolated system it increases in irreversible processes and stays constant in reversible ones."], "formulas": [{"label": "Entropy change", "expr": "dS = δQ_rev / T"}, {"label": "Clausius inequality", "expr": "∮ δQ / T ≤ 0"}], "remember": "The entropy of an isolated system never decreases. Its unit is J/K."},
      {"topic": 5, "intro": "A **pure substance** has a fixed chemical composition in every phase, like water and steam.", "points": ["Heating water at constant pressure: compressed liquid → saturated liquid → wet steam → dry saturated steam → **superheated steam**.", "At the **critical point**, liquid and vapour become indistinguishable and latent heat is zero.", "At the **triple point**, solid, liquid and vapour coexist."], "formulas": [{"label": "Dryness fraction", "expr": "x = m_vapour / (m_vapour + m_liquid)"}, {"label": "Enthalpy of wet steam", "expr": "h = h_f + x · h_fg"}], "remember": "x = 0 is saturated liquid and x = 1 is dry saturated vapour."},
      {"topic": 6, "intro": "Gas power cycles model IC engines using **air-standard assumptions**: air is an ideal gas and combustion is treated as heat addition.", "points": ["**Otto cycle** (petrol engines): heat added at constant volume.", "**Diesel cycle**: heat added at constant pressure.", "**Compression ratio** r = V_max / V_min.", "For the same compression ratio and heat input, Otto is more efficient than Diesel."], "formulas": [{"label": "Otto efficiency", "expr": "η = 1 − 1 / r^(γ−1)"}], "remember": "Otto efficiency depends only on r (and γ). Diesel efficiency also depends on the cut-off ratio."},
    ]),
    units: units("thermo", [
      { name: "Laws of Thermodynamics", topics: [1, 2, 4] },
      { name: "Engines, Cycles and Steam", topics: [3, 5, 6] },
    ]),
    currentTopicId: null,
    planMode: "standard",
    planSort: "recommended",
    mnemonics: mnemonics("thermo", [
      {"topic": 1, "title": "Closed keeps mass, isolated keeps everything", "trick": "Closed: mass stays in. Open: anything goes. Isolated: nothing in, nothing out.", "explain": "Closed systems exchange only energy; open systems exchange mass and energy; isolated exchange neither."},
      {"topic": 2, "title": "Heat in, work out, rest stays inside", "trick": "Q − W = ΔU: heat comes In, work goes Out, the rest stays Inside as internal energy.", "explain": "Heat added is positive and work done by the system is positive."},
      {"topic": 3, "title": "Carnot cares about Kelvin", "trick": "Carnot cares about Kelvin: efficiency is 1 − cold/hot, both in K.", "explain": "η = 1 − T_L/T_H. Using °C gives wrong answers."},
      {"topic": 4, "title": "No perfect engine, no free fridge", "trick": "Kelvin–Planck: no perfect engine. Clausius: no free fridge.", "explain": "You can't turn all heat into work, and heat won't flow cold → hot without work."},
      {"topic": 5, "title": "Zero is water, one is vapour", "trick": "x = 0 means zero vapour; x = 1 means one hundred percent vapour.", "explain": "Dryness fraction is the mass fraction of dry vapour in wet steam."},
      {"topic": 6, "title": "Otto's two O's", "trick": "Otto has two O's for cOnstant vOlume; Diesel Pushes at constant Pressure.", "explain": "Otto adds heat at constant volume, Diesel at constant pressure."},
    ]),
    diagrams: diagrams("thermo", [
      {"topic": 3, "title": "Carnot cycle on a P-V diagram", "labels": ["Isothermal expansion", "Adiabatic expansion", "Isothermal compression", "Adiabatic compression"]},
      {"topic": 5, "title": "T-s diagram for water", "labels": ["Saturated liquid line", "Wet region", "Critical point", "Superheated region"]},
      {"topic": 6, "title": "Otto cycle on a P-V diagram", "labels": ["Isentropic compression", "Heat added at constant volume", "Isentropic expansion", "Heat rejected at constant volume"]},
    ]),
    recordings: [],
    written: written("thermo", [
      {"topic": 1, "marks": 5, "question": "Distinguish between closed, open and isolated systems with one example each.", "keyPoints": ["mass", "energy", "boundary", "closed", "open", "isolated"], "modelAnswer": "Closed: energy crosses the boundary but mass doesn't (gas in a piston-cylinder). Open: both cross (a turbine). Isolated: neither crosses (an ideal thermos flask)."},
      {"topic": 2, "marks": 5, "question": "State the first law of thermodynamics for a closed system and for a cycle.", "keyPoints": ["energy", "conservation", "heat", "work", "internal energy", "cycle"], "modelAnswer": "Energy is conserved. For a closed system, Q − W = ΔU: heat added minus work done equals the change in internal energy. For a cycle, ΔU = 0, so net heat equals net work."},
      {"topic": 3, "marks": 5, "question": "State the Carnot principles and write the efficiency of a Carnot engine.", "keyPoints": ["reversible", "reservoir", "temperature", "kelvin", "efficiency"], "modelAnswer": "No engine between two reservoirs is more efficient than a reversible one, and all reversible engines between the same reservoirs have equal efficiency: η = 1 − T_L/T_H, with temperatures in kelvin."},
      {"topic": 4, "marks": 5, "question": "State the Kelvin–Planck and Clausius statements of the second law.", "keyPoints": ["single reservoir", "cyclic", "work", "cold", "hot", "external"], "modelAnswer": "Kelvin–Planck: no cyclic device can produce net work while exchanging heat with a single reservoir. Clausius: heat can't flow from a cold body to a hot body without external work."},
      {"topic": 5, "marks": 5, "question": "Define dryness fraction. What are its values for saturated liquid and dry saturated steam?", "keyPoints": ["mass", "vapour", "wet steam", "liquid", "dry"], "modelAnswer": "Dryness fraction x is the mass of dry vapour divided by the total mass of wet steam. x = 0 for saturated liquid and x = 1 for dry saturated steam."},
      {"topic": 4, "marks": 10, "question": "Explain entropy. Show that the entropy of an isolated system increases in an irreversible process.", "keyPoints": ["entropy", "disorder", "reversible", "irreversible", "Clausius", "inequality", "isolated", "increase"], "modelAnswer": "Entropy (dS = δQ_rev/T) measures disorder. From the Clausius inequality, dS ≥ δQ/T. An isolated system has δQ = 0, so dS ≥ 0: entropy increases in irreversible processes and stays constant in reversible ones."},
      {"topic": 6, "marks": 10, "question": "With P-V and T-s diagrams, explain the Otto cycle and derive its air-standard efficiency.", "keyPoints": ["isentropic", "constant volume", "compression ratio", "heat addition", "heat rejection", "efficiency", "specific heat"], "modelAnswer": "Otto cycle: isentropic compression, constant-volume heat addition, isentropic expansion, constant-volume heat rejection. Using the ratio of specific heats γ, η = 1 − 1/r^(γ−1), where r is the compression ratio."},
      {"topic": 2, "marks": 10, "question": "Apply the steady flow energy equation to a nozzle and a turbine.", "keyPoints": ["enthalpy", "kinetic energy", "velocity", "work", "adiabatic", "steady flow"], "modelAnswer": "Nozzle: no work, adiabatic, so the enthalpy drop becomes kinetic energy: V₂ = √(2(h₁ − h₂) + V₁²). Turbine: adiabatic, small velocity change, so work per kg w = h₁ − h₂."},
    ]),
    studyPlan: withIds("thermo-task", [
      { day: -2, title: "Review Basic Concepts flashcards", tool: "flashcards", done: true },
      { day: -1, title: "Read First Law notes", tool: "notes", done: true },
      { day: 0, title: "Review 10 First Law flashcards", tool: "flashcards", done: true },
      { day: 0, title: "Quiz: Second Law & Entropy", tool: "quiz", done: false },
      { day: 1, title: "Read Second Law & Entropy notes", tool: "notes", done: false },
      { day: 3, title: "Quiz: Carnot Cycle & Heat Engines", tool: "quiz", done: false },
      { day: 5, title: "Read Pure Substances notes", tool: "notes", done: false },
      { day: 6, title: "Review Gas Power Cycles flashcards", tool: "flashcards", done: false },
    ]),
  };

  const dbmsSet = {
    id: "dbms",
    name: "DBMS",
    emoji: "🗄️",
    colour: "#A78BFA",
    subject: "Database Management Systems",
    examInDays: 2,
    folderId: "semester-3",
    createdAt: "2026-10-11",
    openedHoursAgo: 5,
    lastActivity: { tool: "quiz", position: 7, total: 21 },
    files: withIds("dbms-file", [
      { name: "DBMS_Unit1_ER_Model.pdf", type: "pdf", date: "2026-10-11" },
      { name: "Normalization_Slides.pptx", type: "pptx", date: "2026-10-15" },
      { name: "SQL_Practice_Queries.docx", type: "docx", date: "2026-10-19" },
    ]),
    topics: withIds("dbms-topic", [
      { name: "SQL Queries", mastery: 74 },
      { name: "ER Modeling", mastery: 60 },
      { name: "Normalization", mastery: 48 },
      { name: "Transactions & ACID", mastery: 38 },
      { name: "Indexing", mastery: 30 },
      { name: "Concurrency Control", mastery: 20 },
    ]),
    flashcards: cards("dbms", [
      [1, "What is a DBMS?", "Software for creating, storing, querying and managing databases. It handles concurrency, security, integrity and recovery so applications don't have to."],
      [2, "Primary key", "An attribute (or set) that uniquely identifies each row. It must be unique and NOT NULL, and a table has only one."],
      [2, "Foreign key", "An attribute that refers to the primary key of another table. It enforces referential integrity."],
      [2, "Super key vs candidate key", "A super key is any set of attributes that uniquely identifies a row. A candidate key is a minimal super key. One candidate key is chosen as the primary key."],
      [4, "ACID", "Atomicity (all or nothing), Consistency (valid state to valid state), Isolation (concurrent transactions don't interfere), Durability (committed changes survive failures)."],
      [3, "First Normal Form (1NF)", "Every attribute holds atomic values: no repeating groups or multi-valued attributes."],
      [3, "Second Normal Form (2NF)", "In 1NF, and no non-prime attribute is partially dependent on part of a candidate key."],
      [3, "Third Normal Form (3NF)", "In 2NF, and no non-prime attribute is transitively dependent on a candidate key."],
      [3, "BCNF", "For every non-trivial functional dependency X → Y, X must be a super key. It is stricter than 3NF."],
      [2, "ER model components", "Entities (rectangles), attributes (ovals), relationships (diamonds). Weak entities use double rectangles."],
      [1, "DDL vs DML", "DDL defines structure: CREATE, ALTER, DROP, TRUNCATE. DML manipulates data: SELECT, INSERT, UPDATE, DELETE."],
      [1, "INNER JOIN vs LEFT JOIN", "INNER JOIN returns only matching rows. LEFT JOIN returns every row from the left table, with NULLs where there is no match on the right."],
      [1, "WHERE vs HAVING", "WHERE filters rows before grouping. HAVING filters groups after GROUP BY and can use aggregate functions."],
      [5, "What is an index?", "A data structure, usually a B+ tree, that speeds up lookups on a column. The cost is extra storage and slower writes."],
      [4, "What is a transaction?", "A logical unit of work made of one or more operations that must all succeed (COMMIT) or all be undone (ROLLBACK)."],
      [6, "Deadlock", "Two or more transactions each wait for a lock held by another, so none can proceed. Needs mutual exclusion, hold-and-wait, no preemption and circular wait."],
      [6, "Two-phase locking (2PL)", "A growing phase (acquire locks only) followed by a shrinking phase (release locks only). It guarantees conflict serializability."],
      [1, "What is a view?", "A virtual table defined by a stored query. It stores no data itself and is used for security and simpler queries."],
      [5, "Clustered vs non-clustered index", "A clustered index sets the physical order of rows, so a table has at most one. A non-clustered index is a separate structure that points to the rows."],
      [5, "Why B+ trees for indexes?", "They stay balanced, keep lookups at O(log n), and link their leaf nodes so range queries are fast."],
      [5, "When not to add an index", "On small tables, on columns rarely searched, or on columns updated very often, because every write must also update the index."],
      [6, "Lost update problem", "Two transactions read the same value and both write it back, so one update silently overwrites the other."],
      [4, "Transaction states", "Active → partially committed → committed, or active → failed → aborted (rolled back)."],
    ]),
    quiz: questions("dbms", [
      { topic: 1, question: "Which of these is a DDL command?", options: ["SELECT", "INSERT", "CREATE", "UPDATE"], answer: 2, explanation: "CREATE defines structure, so it is DDL. The other three are DML." },
      { topic: 2, question: "Which key uniquely identifies a row and cannot be NULL?", options: ["Foreign key", "Primary key", "Candidate key only", "Composite attribute"], answer: 1, explanation: "A primary key must be unique and NOT NULL." },
      { topic: 4, question: "In ACID, the \"I\" stands for:", options: ["Integrity", "Isolation", "Indexing", "Independence"], answer: 1, explanation: "Isolation means concurrent transactions behave as if they ran one after another." },
      { topic: 3, question: "A relation in BCNF is always in:", options: ["3NF", "4NF", "5NF", "None of these"], answer: 0, explanation: "BCNF is stricter than 3NF, so every BCNF relation is also in 3NF (and therefore in 2NF and 1NF)." },
      { topic: 1, question: "Which join returns all rows from the left table?", options: ["INNER JOIN", "LEFT JOIN", "RIGHT JOIN", "CROSS JOIN"], answer: 1, explanation: "LEFT (OUTER) JOIN keeps every left-table row and fills unmatched right columns with NULL." },
      { topic: 1, question: "Which keyword removes duplicate rows from a SELECT result?", options: ["UNIQUE", "DISTINCT", "DIFFERENT", "GROUP"], answer: 1, explanation: "SELECT DISTINCT returns only unique rows." },
      { topic: 1, question: "Which clause filters groups using aggregate functions?", options: ["WHERE", "ORDER BY", "HAVING", "LIMIT"], answer: 2, explanation: "HAVING runs after GROUP BY and can use aggregates such as COUNT(*) > 5. WHERE cannot." },
      { topic: 3, question: "Transitive dependencies are removed when moving to:", options: ["1NF", "2NF", "3NF", "BCNF"], answer: 2, explanation: "2NF removes partial dependencies; 3NF removes transitive ones." },
      { topic: 1, question: "Which clause sorts the result of a query?", options: ["SORT BY", "ORDER BY", "GROUP BY", "ARRANGE BY"], answer: 1, explanation: "ORDER BY sorts, ascending by default; add DESC for descending." },
      { topic: 4, question: "Durability is mainly ensured by:", options: ["Locking", "Normalization", "The recovery manager using logs", "Indexing"], answer: 2, explanation: "Write-ahead logs let the recovery manager redo committed changes after a crash." },
      { topic: 6, question: "Which is NOT one of the necessary conditions for deadlock?", options: ["Mutual exclusion", "Hold and wait", "Circular wait", "Preemption"], answer: 3, explanation: "The condition is NO preemption. If resources could be preempted, deadlock could be broken." },
      { topic: 1, question: "COUNT(column_name) counts:", options: ["All rows", "Only non-NULL values in that column", "Only distinct values", "Only NULL values"], answer: 1, explanation: "COUNT(col) skips NULLs. COUNT(*) counts every row." },
      { topic: 2, question: "In an ER diagram, a weak entity set is drawn as a:", options: ["Single rectangle", "Double rectangle", "Diamond", "Dashed oval"], answer: 1, explanation: "Weak entities use a double rectangle and their identifying relationship uses a double diamond." },
      { topic: 6, question: "Two-phase locking guarantees:", options: ["Freedom from deadlock", "Conflict serializability", "Faster queries", "No cascading rollbacks"], answer: 1, explanation: "Basic 2PL ensures conflict serializability but can still deadlock and cause cascading rollbacks; strict 2PL prevents the latter." },
      { topic: 1, question: "A view in SQL is best described as:", options: ["A copy of a table", "A virtual table based on a query", "An index", "A stored procedure"], answer: 1, explanation: "A view stores the query, not the data. Results are computed when it is queried (unless it is materialised)." },
      { topic: 2, question: "A foreign key constraint enforces:", options: ["Entity integrity", "Referential integrity", "Domain integrity", "Normalization"], answer: 1, explanation: "It ensures every foreign key value matches an existing primary key value, or is NULL." },
      {"topic": 5, "question": "Which data structure do most DBMSs use for indexes?", "options": ["Linked list", "Stack", "B+ tree", "Queue"], "answer": 2, "explanation": "B+ trees stay balanced and link their leaves, which suits both exact lookups and range queries."},
      {"topic": 5, "question": "How many clustered indexes can a table have?", "options": ["None", "One", "Two", "Unlimited"], "answer": 1, "explanation": "A clustered index sets the physical order of rows, and rows can only be stored in one order."},
      {"topic": 5, "question": "Adding many indexes to a table mainly slows down:", "options": ["SELECT queries", "INSERT, UPDATE and DELETE", "Creating views", "Nothing"], "answer": 1, "explanation": "Every write has to update each index too. Reads usually get faster."},
      {"topic": 6, "question": "A dirty read happens when a transaction:", "options": ["Reads data another transaction hasn't committed yet", "Reads deleted data", "Reads the same data twice", "Reads from an index"], "answer": 0, "explanation": "If the other transaction rolls back, the value that was read never officially existed."},
      {"topic": 4, "question": "Which command makes a transaction's changes permanent?", "options": ["SAVE", "COMMIT", "ROLLBACK", "END"], "answer": 1, "explanation": "COMMIT ends the transaction and makes its changes durable. ROLLBACK undoes them."},
    ]),
    notes: notes("dbms", [
      {"topic": 1, "intro": "**SQL** is the standard language for defining and querying relational databases.", "points": ["**DDL** defines structure: CREATE, ALTER, DROP, TRUNCATE. **DML** works with data: SELECT, INSERT, UPDATE, DELETE.", "`WHERE` filters rows before grouping; `HAVING` filters groups after `GROUP BY`.", "**INNER JOIN** keeps matching rows; **LEFT JOIN** keeps every left row and fills gaps with NULL.", "`COUNT(*)` counts rows; `COUNT(column)` skips NULLs."], "formulas": [{"label": "Clause order", "expr": "SELECT … FROM … WHERE … GROUP BY … HAVING … ORDER BY …"}], "remember": "Aggregates can't go in WHERE. If the condition uses COUNT, SUM or AVG, it belongs in HAVING."},
      {"topic": 2, "intro": "The **ER model** describes data as entities, their attributes, and the relationships between them.", "points": ["Entity = rectangle, attribute = oval, relationship = diamond. A **weak entity** uses a double rectangle.", "**Super key** ⊇ **candidate key** (minimal) ⊇ **primary key** (the one chosen).", "A **foreign key** refers to another table's primary key and enforces **referential integrity**.", "Cardinality: one-to-one, one-to-many, many-to-many."], "remember": "Primary key = unique + NOT NULL, one per table. Candidate keys are the minimal options to choose it from."},
      {"topic": 3, "intro": "**Normalization** removes redundancy and update anomalies by splitting tables using **functional dependencies**.", "points": ["**1NF**: atomic values, no repeating groups.", "**2NF**: 1NF + no partial dependency on part of a candidate key.", "**3NF**: 2NF + no transitive dependency.", "**BCNF**: for every non-trivial X → Y, X is a super key."], "remember": "Each normal form includes the ones before it: every BCNF table is in 3NF, and every 3NF table is in 2NF."},
      {"topic": 4, "intro": "A **transaction** is a unit of work that must succeed completely (COMMIT) or not at all (ROLLBACK).", "points": ["**Atomicity**: all or nothing. **Consistency**: from one valid state to another.", "**Isolation**: concurrent transactions don't see each other's partial work. **Durability**: committed changes survive crashes.", "States: active, partially committed, committed, failed, aborted.", "The **recovery manager** uses logs to undo failed work and redo committed work."], "remember": "Durability comes from write-ahead logging: the log is written before the data."},
      {"topic": 5, "intro": "An **index** is an extra structure that speeds up lookups on a column, like the index of a book.", "points": ["Most DBMSs use **B+ trees**: balanced, with all data pointers at the leaves for fast range scans.", "A **clustered index** sets the physical row order, so a table has at most one. **Non-clustered** indexes are separate structures.", "Indexes speed up SELECT but slow down INSERT, UPDATE and DELETE, and take extra storage."], "remember": "Index columns you often search, join or sort on. Skip tiny tables and columns that change constantly."},
      {"topic": 6, "intro": "**Concurrency control** keeps simultaneous transactions from corrupting each other's data.", "points": ["Problems without it: **lost update**, **dirty read** (reading uncommitted data), unrepeatable read.", "**Two-phase locking (2PL)**: a growing phase (only acquire locks), then a shrinking phase (only release). It guarantees conflict serializability.", "**Deadlock** needs mutual exclusion, hold and wait, no preemption and circular wait."], "remember": "Basic 2PL can still deadlock. Strict 2PL holds write locks until commit to avoid cascading rollbacks."},
    ]),
    units: units("dbms", [
      { name: "Data Modelling and SQL", topics: [1, 2, 3] },
      { name: "Transactions and Storage", topics: [4, 5, 6] },
    ]),
    currentTopicId: null,
    planMode: "standard",
    planSort: "recommended",
    mnemonics: mnemonics("dbms", [
      {"topic": 1, "title": "Some French Waiters Grow Healthy Oranges", "trick": "Some French Waiters Grow Healthy Oranges.", "explain": "SELECT, FROM, WHERE, GROUP BY, HAVING, ORDER BY: the order you write the clauses."},
      {"topic": 2, "title": "Super Cats Purr", "trick": "Super Cats Purr: every Primary key is a Candidate key, and every Candidate key is a Super key.", "explain": "Super key ⊇ candidate key (minimal) ⊇ primary key (the chosen one)."},
      {"topic": 3, "title": "The key, the whole key, nothing but the key", "trick": "Every non-key attribute depends on the key (1NF), the whole key (2NF), and nothing but the key (3NF).", "explain": "2NF removes partial dependencies; 3NF removes transitive ones."},
      {"topic": 4, "title": "The bank transfer test", "trick": "Picture a bank transfer: All or nothing, Correct totals, In private, Down-proof.", "explain": "Atomicity, Consistency, Isolation, Durability."},
      {"topic": 5, "title": "One page order, many indexes", "trick": "A book has one page order but many indexes at the back.", "explain": "Only one clustered index (physical order) per table; many non-clustered indexes."},
      {"topic": 6, "title": "My Hamster Never Circles", "trick": "Deadlock needs: My Hamster Never Circles.", "explain": "Mutual exclusion, Hold and wait, No preemption, Circular wait."},
    ]),
    diagrams: diagrams("dbms", [
      {"topic": 2, "title": "ER diagram notation", "labels": ["Entity", "Attribute", "Relationship", "Weak entity", "Key attribute"]},
      {"topic": 5, "title": "B+ tree index", "labels": ["Root", "Internal nodes", "Leaf nodes", "Leaf links"]},
      {"topic": 4, "title": "Transaction states", "labels": ["Active", "Partially committed", "Committed", "Failed", "Aborted"]},
    ]),
    recordings: [],
    written: written("dbms", [
      {"topic": 3, "marks": 5, "question": "Explain 2NF and 3NF with an example.", "keyPoints": ["partial dependency", "transitive", "candidate key", "functional dependency", "non-prime"], "modelAnswer": "2NF: in 1NF with no non-prime attribute partially dependent on part of a candidate key. 3NF: in 2NF with no transitive dependency, e.g. split StudentID → DeptID → DeptName into two tables."},
      {"topic": 4, "marks": 5, "question": "Explain the ACID properties of a transaction.", "keyPoints": ["atomicity", "consistency", "isolation", "durability", "commit"], "modelAnswer": "Atomicity: all or nothing. Consistency: valid state to valid state. Isolation: concurrent transactions don't interfere. Durability: once committed, changes survive failures."},
      {"topic": 2, "marks": 5, "question": "Differentiate between primary key, candidate key and foreign key.", "keyPoints": ["unique", "null", "minimal", "references", "referential integrity"], "modelAnswer": "A candidate key is a minimal set of attributes that uniquely identifies a row. The primary key is the chosen candidate key: unique and not null. A foreign key references another table's primary key to enforce referential integrity."},
      {"topic": 1, "marks": 5, "question": "Differentiate between WHERE and HAVING with an example query.", "keyPoints": ["GROUP BY", "aggregate", "rows", "groups", "COUNT"], "modelAnswer": "WHERE filters rows before grouping and can't use aggregates. HAVING filters groups after GROUP BY, e.g. SELECT dept, COUNT(*) FROM student GROUP BY dept HAVING COUNT(*) > 30."},
      {"topic": 5, "marks": 5, "question": "What is an index? Compare clustered and non-clustered indexes.", "keyPoints": ["B+ tree", "physical order", "one per table", "lookup", "pointer"], "modelAnswer": "An index (usually a B+ tree) speeds up lookups on a column. A clustered index sets the physical order of rows, so there's one per table. A non-clustered index is separate and stores pointers to rows."},
      {"topic": 3, "marks": 10, "question": "Define BCNF. Normalise a relation step by step from 1NF to BCNF, explaining each step.", "keyPoints": ["atomic", "partial dependency", "transitive", "super key", "functional dependency", "decompose", "lossless"], "modelAnswer": "1NF: make values atomic. 2NF: remove partial dependencies. 3NF: remove transitive dependencies. BCNF: for every functional dependency X → Y, X must be a super key. Decompose at each step so the join is lossless."},
      {"topic": 6, "marks": 10, "question": "Explain two-phase locking. How does it ensure serializability, and how can deadlocks still occur?", "keyPoints": ["growing", "shrinking", "lock", "serializab", "deadlock", "circular wait", "strict"], "modelAnswer": "2PL has a growing phase (acquire locks only) and a shrinking phase (release only), which guarantees conflict serializability. Deadlock can still occur when transactions wait on each other's locks in a circular wait. Strict 2PL holds write locks until commit."},
      {"topic": 1, "marks": 10, "question": "Write SQL to create a Student table, insert rows, and find departments with more than 30 students.", "keyPoints": ["CREATE TABLE", "INSERT INTO", "SELECT", "COUNT", "GROUP BY", "HAVING", "PRIMARY KEY"], "modelAnswer": "CREATE TABLE student (id INT PRIMARY KEY, name VARCHAR(50), dept VARCHAR(20)); INSERT INTO student VALUES (1, 'Asha', 'CSE'); SELECT dept, COUNT(*) FROM student GROUP BY dept HAVING COUNT(*) > 30;"},
    ]),
    studyPlan: withIds("dbms-task", [
      { day: -1, title: "Review Keys & ER Model flashcards", tool: "flashcards", done: true },
      { day: 0, title: "Read Normalization notes", tool: "notes", done: false },
      { day: 1, title: "Quiz: Transactions & ACID", tool: "quiz", done: false },
      { day: 1, title: "Review all DBMS flashcards", tool: "flashcards", done: false },
      { day: 1, title: "Final revision quiz", tool: "quiz", done: false },
    ]),
  };

  const SEED_SETS = [javaSet, thermoSet, dbmsSet];

  // User-made folders for grouping sets. A set's folderId is one of these ids, or null.
  const SEED_FOLDERS = [{ id: "semester-3", name: "Semester 3" }];

  // ---------------------------------------------------------------------------
  // Storage
  // ---------------------------------------------------------------------------

  const clone = (value) => JSON.parse(JSON.stringify(value));

  let memory = null; // fallback if localStorage is unavailable (private mode, blocked storage)

  // Turns the relative seed fields into real dates, counted from today.
  function seed() {
    const today = todayISO();
    const sets = clone(SEED_SETS).map(({ examInDays, openedHoursAgo, studyPlan, ...set }) => ({
      ...set,
      examDate: addDays(today, examInDays),
      lastOpened: new Date(Date.now() - openedHoursAgo * 3600000).toISOString(),
      studyPlan: studyPlan.map(({ day, ...task }) => ({ ...task, date: addDays(today, day) })),
      planExamDate: addDays(today, examInDays), // the exam date the study plan was built for
      // Spaced repetition: roughly two thirds of each deck is due today.
      flashcards: set.flashcards.map((card, i) => (i % 3 === 0
        ? { ...card, interval: 4, due: addDays(today, 1 + (i % 4)) }
        : { ...card, interval: 1, due: addDays(today, -(i % 2)) })),
    }));
    // The hand-written plans cover about a week; fill the rest of the way to each exam.
    for (const set of sets) {
      const last = set.studyPlan.reduce((max, t) => (t.date > max ? t.date : max), today);
      set.studyPlan.push(...generateTasks(set, addDays(last, 1), set.examDate));
    }

    // One past lecture recording so the Record page has history.
    const java = sets.find((x) => x.id === "java");
    const lecture = buildRecording(java, "java-topic-3", 1260, addDays(today, -3));
    java.recordings.push(lecture.recording);
    java.files.push(lecture.file);
    const user = clone(SEED_USER);
    user.studyToday.date = today;
    user.history = seedHistory(today);

    const ago = (hours) => new Date(Date.now() - hours * 3600000).toISOString();
    const activities = [
      { setId: "java", type: "quiz", text: "Took a quiz in Java, 7/10", at: ago(2) },
      { setId: "java", type: "flashcards", text: "Reviewed 20 flashcards in Java", at: ago(5) },
      { setId: "dbms", type: "quiz", text: "Took a quiz in DBMS, 4/10", at: ago(28) },
      { setId: "thermo", type: "notes", text: "Read notes on First Law of Thermodynamics", at: ago(30) },
      { setId: "java", type: "record", text: "Recorded a lecture: Exception Handling", at: ago(72) },
      { setId: "dbms", type: "upload", text: "Uploaded SQL_Practice_Queries.docx to DBMS", at: ago(80) },
    ].map((a, i) => ({ id: `act-seed-${i + 1}`, ...a }));

    return { sets, folders: clone(SEED_FOLDERS), user, activities };
  }

  // 16 weeks of mock study minutes. Fixed pattern so the demo looks the same
  // every time: a 7-day current streak (today counts via studyToday), a gap
  // 7 days ago, and a 12-day run about six weeks back (the longest streak).
  function seedHistory(today) {
    const history = {};
    let x = 7;
    const rand = () => { x = (x * 9301 + 49297) % 233280; return x / 233280; };
    for (let i = 1; i < 16 * 7; i++) {
      const r = rand();
      let minutes = r < 0.35 ? 0 : Math.round(10 + rand() * 80);
      if (i < 7) minutes = Math.max(minutes, 20 + i * 7);   // current streak
      if (i === 7 || i === 39 || i === 52) minutes = 0;     // streak breaks
      if (i >= 40 && i <= 51) minutes = Math.max(minutes, 35); // longest run: 12 days
      if (i > 7 && i < 39 && minutes > 0 && i % 5 === 0) minutes = 0; // no run longer than 12
      if (i > 52 && minutes > 0 && i % 9 === 0) minutes = 0;
      if (minutes) history[addDays(today, -i)] = minutes;
    }
    return history;
  }

  function load() {
    if (memory) return memory;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        memory = JSON.parse(raw);
        return memory;
      }
    } catch (err) {
      console.warn("SkipXam: could not read saved data, using seed data.", err);
    }
    memory = seed();
    persist();
    return memory;
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(memory));
    } catch (err) {
      console.warn("SkipXam: could not save data; changes will be lost on refresh.", err);
    }
  }

  function slugify(text) {
    return String(text)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "set";
  }

  // ---------------------------------------------------------------------------
  // Public helpers. All getters return copies; call saveSet() to persist changes.
  // ---------------------------------------------------------------------------

  function getSets() {
    return clone(load().sets);
  }

  function getSet(id) {
    const set = load().sets.find((s) => s.id === id);
    return set ? clone(set) : null;
  }

  // Inserts the set, or replaces the existing set with the same id.
  function saveSet(set) {
    if (!set || !set.id) throw new Error("saveSet: set must have an id");
    const data = load();
    const index = data.sets.findIndex((s) => s.id === set.id);
    if (index === -1) data.sets.push(clone(set));
    else data.sets[index] = clone(set);
    persist();
    return clone(set);
  }

  function createSet(data = {}) {
    const existing = load().sets;
    const base = slugify(data.name || "Untitled set");
    let id = base;
    for (let n = 2; existing.some((s) => s.id === id); n++) id = `${base}-${n}`;

    const set = {
      name: "Untitled set",
      emoji: "📘",
      colour: "#E08A38",
      subject: "",
      examDate: null,
      files: [],
      topics: [],
      flashcards: [],
      quiz: [],
      notes: [],
      written: [],
      mnemonics: [],
      diagrams: [],
      recordings: [],
      planExamDate: null,
      units: [],
      currentTopicId: null,
      planMode: "standard",
      planSort: "recommended",
      studyPlan: [],
      lastOpened: null,
      lastActivity: null,
      folderId: null,
      ...data,
      id,
      createdAt: todayISO(),
    };
    return saveSet(set);
  }

  // Average topic mastery for a set, 0–100.
  function getSetMastery(set) {
    if (!set.topics || set.topics.length === 0) return 0;
    const total = set.topics.reduce((sum, t) => sum + t.mastery, 0);
    return Math.round(total / set.topics.length);
  }

  // ---------- Flashcards (simple spaced repetition) ----------
  // A card is due when `due` is missing (new) or on/before today.
  // "Got it" doubles the interval (1, 2, 4, 8... days); "Again" resets it and keeps the card due.

  function isCardDue(card) {
    return !card.due || card.due <= todayISO();
  }

  function reviewFlashcard(setId, cardId, gotIt) {
    const set = load().sets.find((s) => s.id === setId);
    const card = set && set.flashcards.find((c) => c.id === cardId);
    if (!card) throw new Error(`reviewFlashcard: no card "${cardId}" in set "${setId}"`);
    if (gotIt) {
      card.interval = Math.max(1, (card.interval || 0) * 2);
      card.due = addDays(todayISO(), card.interval);
    } else {
      card.interval = 0;
      card.due = todayISO();
    }
    load().user.stats.flashcardsReviewed += 1;
    persist();
  }

  // ---------- Topic mastery ----------
  // results: { [topicId]: { correct, total } } from a quiz or test.
  // New mastery blends the old value with this score (70/30), so one quiz moves it but doesn't overwrite it.
  // Returns [{ topicId, name, before, after, score }].
  function applyTopicResults(setId, results) {
    const set = load().sets.find((s) => s.id === setId);
    if (!set) throw new Error(`applyTopicResults: no set "${setId}"`);
    const changes = [];
    for (const [id, { correct, total }] of Object.entries(results)) {
      const topic = set.topics.find((t) => t.id === id);
      if (!topic || total === 0) continue;
      const score = Math.round((correct / total) * 100);
      const before = topic.mastery;
      topic.mastery = Math.round(before * 0.7 + score * 0.3);
      changes.push({ topicId: id, name: topic.name, before, after: topic.mastery, score });
    }
    persist();
    return changes;
  }

  // Small nudge to one topic's mastery (the tutor uses +5 / −2), clamped to 0–100.
  function adjustTopicMastery(setId, topicIdValue, delta) {
    const set = load().sets.find((s) => s.id === setId);
    const topic = set && set.topics.find((t) => t.id === topicIdValue);
    if (!topic) throw new Error(`adjustTopicMastery: no topic "${topicIdValue}"`);
    topic.mastery = Math.max(0, Math.min(100, topic.mastery + delta));
    persist();
    return topic.mastery;
  }

  // ---------- Study plan ----------

  function setExamDate(setId, examDate) {
    const set = load().sets.find((s) => s.id === setId);
    if (!set) throw new Error(`setExamDate: no set "${setId}"`);
    set.examDate = examDate || null;
    persist();
  }

  // Plan generator: one topic per day (weakest first) with notes, flashcards and
  // a quiz, and a revision day before the exam. Covers [fromDate, examDate).
  const MAX_PLAN_DAYS = 60;

  function generateTasks(set, fromDate, examDate) {
    const days = Math.min(Math.round((parseDate(examDate) - parseDate(fromDate)) / 86400000), MAX_PLAN_DAYS);
    const topics = [...set.topics].sort((a, b) => a.mastery - b.mastery);
    let n = set.studyPlan.reduce((max, t) => Math.max(max, Number(t.id.split("-").pop()) || 0), 0);
    const task = (date, title, tool, topic) => ({
      id: `${set.id}-task-${++n}`, date, title, tool, ...(topic ? { topicId: topic.id } : {}), done: false,
    });

    const tasks = [];
    for (let i = 0; i < days; i++) {
      const date = addDays(fromDate, i);
      if (date === addDays(examDate, -1) && days > 1) {
        tasks.push(task(date, "Final revision quiz", "quiz"), task(date, "Review all due flashcards", "flashcards"));
      } else if (topics.length) {
        const topic = topics[i % topics.length];
        tasks.push(
          task(date, `Read ${topic.name} notes`, "notes", topic),
          task(date, `Review ${topic.name} flashcards`, "flashcards", topic),
          task(date, `Quiz: ${topic.name}`, "quiz", topic));
      } else {
        tasks.push(task(date, "Read your notes", "notes"), task(date, "Review flashcards", "flashcards"));
      }
    }
    return tasks;
  }

  // Rebuilds the plan from today up to the exam. Keeps finished tasks and anything before today.
  function buildStudyPlan(setId) {
    const set = load().sets.find((s) => s.id === setId);
    if (!set) throw new Error(`buildStudyPlan: no set "${setId}"`);
    const today = todayISO();
    const kept = set.studyPlan.filter((t) => t.date < today || t.done);
    const fresh = set.examDate && daysUntil(set.examDate) > 0 ? generateTasks(set, today, set.examDate) : [];
    set.studyPlan = [...kept, ...fresh].sort((a, b) => a.date.localeCompare(b.date));
    set.planExamDate = set.examDate;
    persist();
    return clone(set);
  }

  // ---------- Lecture recordings (mock) ----------
  // The "transcript" is built from the topic's notes so it reads like that lecture.

  const plain = (text) => String(text).replace(/\*\*(.+?)\*\*/g, "$1").replace(/`(.+?)`/g, "$1");

  function buildRecording(set, topicIdValue, durationSec, date) {
    const section = set.notes.find((nt) => nt.topicId === topicIdValue) || set.notes[0];
    const topic = set.topics.find((t) => t.id === (section ? section.topicId : topicIdValue));
    const topicLabel = topic ? topic.name : set.name;
    const sentences = section
      ? [`Okay, today we're covering ${topicLabel}.`, plain(section.intro), ...section.points.map(plain),
        ...section.formulas.map((f) => `${f.label}: ${f.expr}.`), `One thing to remember: ${plain(section.remember)}`]
      : [`Today's lecture is about ${set.name}.`];
    const step = Math.max(5, Math.floor(durationSec / sentences.length));

    const count = set.recordings.length + 1;
    const id = `${set.id}-rec-${count}-${Date.now().toString(36)}`;
    const recording = {
      id,
      title: `${topicLabel} lecture`,
      topicId: topic ? topic.id : null,
      date,
      durationSec,
      transcript: sentences.map((text, i) => ({ at: i * step, text })),
      notes: section ? section.points.map(plain) : [],
    };
    const file = { id: `${id}-file`, name: `${topicLabel} lecture.m4a`, type: "audio", date };
    return { recording, file };
  }

  // Adds a mock recording to the set (and to its sources). Returns the recording.
  function createRecording(setId, { topicId: topicIdValue, durationSec }) {
    const set = load().sets.find((s) => s.id === setId);
    if (!set) throw new Error(`createRecording: no set "${setId}"`);
    const { recording, file } = buildRecording(set, topicIdValue, durationSec, todayISO());
    set.recordings.unshift(recording);
    set.files.push(file);
    persist();
    return clone(recording);
  }

  // ---------- User settings ----------

  function setCalendarConnected(connected) {
    load().user.calendarConnected = Boolean(connected);
    persist();
  }

  function saveReminders(reminders) {
    load().user.reminders = { ...load().user.reminders, ...reminders };
    persist();
    return getUser().reminders;
  }

  // ---------- Topics, units and the topic-level study plan ----------
  // Topic status comes from mastery so quizzes keep it up to date:
  // done ("covered") at 75%+, in progress once started, mastered at 90%+.

  function topicStatus(topic) {
    if (topic.mastery >= 75) return "done";
    if (topic.mastery > 0) return "in-progress";
    return "not-started";
  }

  const isMastered = (topic) => topic.mastery >= 90;

  // Overall progress: done topics count fully, in-progress ones half.
  function getSetProgress(set) {
    if (!set.topics.length) return 0;
    const score = set.topics.reduce((n, t) => n + ({ done: 1, "in-progress": 0.5 }[topicStatus(t)] || 0), 0);
    return Math.round((score / set.topics.length) * 100);
  }

  const PLAN_MODES = {
    cram: { label: "Cram", share: 0.4, hint: "Cram: highest-priority topics only, 40%" },
    standard: { label: "Standard", share: 0.7, hint: "Standard: the topics most likely to come up, 70%" },
    comprehensive: { label: "Comprehensive", share: 1, hint: "Comprehensive: every topic in the syllabus, 100%" },
  };

  const PLAN_SORTS = {
    recommended: { label: "Recommended" },
    exam: { label: "Exam order" },
    weakest: { label: "Weakest first" },
  };

  const STATUS_RANK = { "in-progress": 0, "not-started": 1, done: 2 };

  // The plan as unit groups: [{ unit, topics: [...] }]. The mode keeps the
  // highest-priority (lowest mastery) share of topics; the sort orders topics
  // inside each unit. Units stay in syllabus order.
  function getPlanGroups(set) {
    const mode = PLAN_MODES[set.planMode] || PLAN_MODES.standard;
    const unitList = set.units.length ? set.units
      : [{ id: `${set.id}-unit-all`, name: "All topics", topicIds: set.topics.map((t) => t.id) }];
    const count = Math.ceil(set.topics.length * mode.share);
    const keep = new Set([...set.topics].sort((a, b) => a.mastery - b.mastery).slice(0, count).map((t) => t.id));

    const order = (a, b) => {
      if (set.planSort === "weakest") return a.mastery - b.mastery;
      if (set.planSort === "exam") return 0; // stable sort keeps syllabus order
      return STATUS_RANK[topicStatus(a)] - STATUS_RANK[topicStatus(b)] || a.mastery - b.mastery;
    };

    return unitList
      .map((unit) => ({
        unit,
        topics: unit.topicIds.map((id) => set.topics.find((t) => t.id === id)).filter((t) => t && keep.has(t.id)).sort(order),
      }))
      .filter((g) => g.topics.length);
  }

  function getPlanTopics(set) {
    return getPlanGroups(set).flatMap((g) => g.topics.map((topic) => ({ topic, unit: g.unit, unitTopics: g.topics })));
  }

  // The topic to study now: the chosen one if it's still in the plan, otherwise the first unfinished one.
  function getCurrentTopic(set) {
    const plan = getPlanTopics(set);
    if (!plan.length) return null;
    return plan.find((p) => p.topic.id === set.currentTopicId)
      || plan.find((p) => topicStatus(p.topic) !== "done")
      || plan[0];
  }

  function setCurrentTopic(setId, topicIdValue) {
    const set = load().sets.find((s) => s.id === setId);
    if (!set) throw new Error(`setCurrentTopic: no set "${setId}"`);
    set.currentTopicId = topicIdValue;
    persist();
  }

  // Moves on to the next topic in the plan (wrapping round). Returns the new topic id.
  function skipTopic(setId) {
    const set = getSet(setId);
    const plan = getPlanTopics(set);
    const current = getCurrentTopic(set);
    if (!current) return null;
    const next = plan[(plan.findIndex((p) => p.topic.id === current.topic.id) + 1) % plan.length];
    setCurrentTopic(setId, next.topic.id);
    return next.topic.id;
  }

  function setPlanOptions(setId, { mode, sort }) {
    const set = load().sets.find((s) => s.id === setId);
    if (!set) throw new Error(`setPlanOptions: no set "${setId}"`);
    if (mode && PLAN_MODES[mode]) set.planMode = mode;
    if (sort && PLAN_SORTS[sort]) set.planSort = sort;
    persist();
  }

  // Copies a set's content into a new set named "<name> (copy)". Returns the copy.
  function duplicateSet(setId) {
    const original = getSet(setId);
    if (!original) throw new Error(`duplicateSet: no set "${setId}"`);
    const { id, createdAt, lastOpened, lastActivity, ...content } = original;
    return createSet({ ...content, name: `${original.name} (copy)` });
  }

  // ---------- Activity log ----------
  // type: quiz | flashcards | notes | test | upload | record | tutor

  function logActivity(setId, type, text) {
    const data = load();
    data.activities = data.activities || [];
    data.activities.unshift({ id: `act-${Date.now().toString(36)}`, setId, type, text, at: new Date().toISOString() });
    data.activities = data.activities.slice(0, 50);
    persist();
  }

  function getActivities() {
    return clone(load().activities || []);
  }

  // ---------- Study timer + dismissed hints ----------

  function getStudiedToday() {
    const st = load().user.studyToday;
    return st && st.date === todayISO() ? st.minutes : 0;
  }

  function addStudyMinute() {
    const user = load().user;
    const today = todayISO();
    if (!user.studyToday || user.studyToday.date !== today) user.studyToday = { date: today, minutes: 0 };
    user.studyToday.minutes += 1;
    persist();
    return user.studyToday.minutes;
  }

  function dismissHint(key) {
    const user = load().user;
    user.dismissed = { ...(user.dismissed || {}), [key]: true };
    persist();
  }

  function setTaskDone(setId, taskId, done) {
    const set = load().sets.find((s) => s.id === setId);
    const task = set && set.studyPlan.find((t) => t.id === taskId);
    if (!task) throw new Error(`setTaskDone: no task "${taskId}" in set "${setId}"`);
    task.done = Boolean(done);
    persist();
  }

  // Call from tool pages so "Continue learning" knows where the user left off.
  function recordActivity(setId, tool, position, total) {
    const set = load().sets.find((s) => s.id === setId);
    if (!set) throw new Error(`recordActivity: no set "${setId}"`);
    set.lastOpened = new Date().toISOString();
    set.lastActivity = { tool, position, total };
    persist();
  }

  function getUser() {
    return clone(load().user);
  }

  // plan: "free" | "pro" | "max". billing: "monthly" | "yearly".
  function setPlan(plan, billing) {
    if (!["free", "pro", "max"].includes(plan)) throw new Error(`setPlan: unknown plan "${plan}"`);
    const user = load().user;
    user.plan = plan;
    if (billing) user.billing = billing;
    user.planRenews = plan === "free" ? null : addDays(todayISO(), user.billing === "yearly" ? 365 : 30);
    persist();
    return getUser();
  }

  // ---------- Profile, settings and study history ----------

  function updateProfile(fields) {
    const user = load().user;
    for (const key of ["name", "college", "course", "year", "avatar"]) {
      if (key in fields) user[key] = fields[key];
    }
    persist();
    return getUser();
  }

  function saveSettings(settings) {
    const user = load().user;
    user.settings = { ...user.settings, ...settings };
    persist();
    applyTheme();
    return getUser().settings;
  }

  // Sets <html data-theme> from the saved setting. Runs on every page load.
  function applyTheme() {
    const theme = (load().user.settings || {}).theme || "dark";
    document.documentElement.dataset.theme = theme;
  }

  // The last `days` days, oldest first: [{ date, minutes }]. Today uses the live timer.
  function getStudyHistory(days) {
    const user = load().user;
    const today = todayISO();
    return Array.from({ length: days }, (_, i) => {
      const date = addDays(today, i - days + 1);
      return { date, minutes: date === today ? getStudiedToday() : (user.history || {})[date] || 0 };
    });
  }

  // Streaks in days. The current streak still counts if today has no study yet.
  function getStreaks() {
    const days = getStudyHistory(16 * 7);
    let longest = 0;
    let run = 0;
    for (const d of days) {
      run = d.minutes > 0 ? run + 1 : 0;
      longest = Math.max(longest, run);
    }
    let current = 0;
    for (let i = days.length - 1; i >= 0; i--) {
      if (days[i].minutes > 0) current++;
      else if (i === days.length - 1) continue; // today not started yet
      else break;
    }
    return { current, longest };
  }

  function getUserStats() {
    const user = load().user;
    const minutes = getStudyHistory(16 * 7).reduce((sum, d) => sum + d.minutes, 0);
    const { flashcardsReviewed, quizzesTaken, quizScoreTotal } = user.stats;
    return {
      hours: Math.round(minutes / 60),
      flashcards: flashcardsReviewed,
      quizzes: quizzesTaken,
      avgScore: quizzesTaken ? Math.round(quizScoreTotal / quizzesTaken) : 0,
    };
  }

  // pct: the quiz score, 0–100.
  function recordQuizScore(pct) {
    const stats = load().user.stats;
    stats.quizzesTaken += 1;
    stats.quizScoreTotal += pct;
    persist();
  }

  function exportData() {
    return JSON.stringify(load(), null, 2);
  }

  // files: [{ name, type }] where type is pdf | image | pptx | docx. Dated today.
  function addFilesToSet(setId, files) {
    const set = load().sets.find((s) => s.id === setId);
    if (!set) throw new Error(`addFilesToSet: no set "${setId}"`);
    let n = set.files.length;
    for (const file of files) {
      let id;
      do { id = `${setId}-file-${++n}`; } while (set.files.some((f) => f.id === id));
      set.files.push({ id, name: file.name, type: file.type, date: todayISO() });
    }
    persist();
    return clone(set);
  }

  // Updates "last opened" so the dashboard's Continue learning order stays current.
  function markSetOpened(setId) {
    const set = load().sets.find((s) => s.id === setId);
    if (!set) return;
    set.lastOpened = new Date().toISOString();
    persist();
  }

  function deleteSet(id) {
    const data = load();
    data.sets = data.sets.filter((s) => s.id !== id);
    persist();
  }

  // ---------- Folders ----------

  function getFolders() {
    return clone(load().folders);
  }

  // Returns the existing folder if one with the same name (any case) exists.
  function createFolder(name) {
    const clean = String(name).trim();
    if (!clean) throw new Error("createFolder: name is required");
    const data = load();
    const existing = data.folders.find((f) => f.name.toLowerCase() === clean.toLowerCase());
    if (existing) return clone(existing);

    const base = slugify(clean);
    let id = base;
    for (let n = 2; data.folders.some((f) => f.id === id); n++) id = `${base}-${n}`;
    const folder = { id, name: clean };
    data.folders.push(folder);
    persist();
    return clone(folder);
  }

  // folderId null removes the set from any folder.
  function moveSetToFolder(setId, folderId) {
    const data = load();
    const set = data.sets.find((s) => s.id === setId);
    if (!set) throw new Error(`moveSetToFolder: no set "${setId}"`);
    if (folderId !== null && !data.folders.some((f) => f.id === folderId)) {
      throw new Error(`moveSetToFolder: no folder "${folderId}"`);
    }
    set.folderId = folderId;
    persist();
  }

  // Wipes saved changes and restores the original mock data.
  function resetData() {
    memory = seed();
    persist();
  }

  applyTheme();

  Object.assign(window, {
    getSets, getSet, saveSet, createSet, deleteSet, addFilesToSet, markSetOpened,
    getUser, setPlan, resetData, updateProfile, saveSettings, applyTheme,
    getStudyHistory, getStreaks, getUserStats, recordQuizScore, exportData,
    getFolders, createFolder, moveSetToFolder,
    getSetMastery, setTaskDone, recordActivity, isCardDue, reviewFlashcard, applyTopicResults,
    adjustTopicMastery, setExamDate, buildStudyPlan, createRecording, setCalendarConnected, saveReminders,
    topicStatus, isMastered, getSetProgress, PLAN_MODES, PLAN_SORTS, getPlanGroups, getPlanTopics,
    getCurrentTopic, setCurrentTopic, skipTopic, setPlanOptions, duplicateSet,
    logActivity, getActivities, getStudiedToday, addStudyMinute, dismissHint,
    toISODate, parseDate, addDays, todayISO, daysUntil,
  });
})();
