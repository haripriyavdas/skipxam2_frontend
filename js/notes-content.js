/*
 * Seed content for the notes editor (app/notes.html). Load before notes.js.
 *
 * NOTES_SEED[setId] = { file, html, stickies, sources }
 *   html      The starting document. <button class="source-star" data-source="id"> marks a
 *             key point; <span class="sticky-anchor" data-sticky="id"> is where a sticky points.
 *   stickies  Auto-generated stickies: { id, kind: tip | mistake | remember | formula, text }.
 *   sources   Where each star came from: { id, page, quote }. `quote` is word for word from
 *             the PDF (assets/sample.pdf), so the source panel can find and highlight it.
 * Sets without an entry get a document built from their smart notes (see notes.js).
 */
(function () {
  "use strict";

  const star = (id) => `<button type="button" class="source-star" contenteditable="false" data-source="${id}" aria-label="Show where this came from in the PDF"></button>`;

  const javaHtml = `
<h1 id="h-intro">Object Oriented Programming with Java: Units 1 and 2</h1>
<p>Complete notes from <strong>Java_Unit1_OOP.pdf</strong>: every heading, definition, example, code sample, table and formula from the lecture notes, rewritten to be easy to revise. Stars mark key points; click one to see the exact passage in the PDF.</p>

<h2 id="h-java">1. Introduction to Java</h2>
<p><strong>Java</strong> is a high-level, class-based, object oriented programming language. It was designed with as few implementation dependencies as possible, so a program written once can run on any device that has a <strong>Java Virtual Machine (JVM)</strong>. This idea is usually summed up as <em>"write once, run anywhere"</em>.</p>
<h3 id="h-features">1.1 Features of Java</h3>
<ul>
<li><strong>Simple and familiar</strong>: syntax similar to C and C++, but without pointers or operator overloading.</li>
<li><strong>Object oriented</strong>: everything except the eight primitive types is an object.</li>
<li><strong>Platform independent</strong>: source code is compiled to bytecode, not to machine code for one processor.</li>
<li><strong>Robust</strong>: strong type checking, automatic garbage collection and exception handling remove whole classes of bugs.</li>
<li><strong>Secure</strong>: there are no explicit pointers, and bytecode is verified before it runs.</li>
<li><strong>Multithreaded</strong>: threads are built into the language and the standard library.</li>
</ul>
<h3 id="h-run">1.2 How a Java program runs</h3>
<p>The compiler, <code>javac</code>, translates a <code>.java</code> source file into a <code>.class</code> file that contains <strong>bytecode</strong>. <span class="sticky-anchor" data-sticky="java-st-1">The JVM never sees your source code: it only executes bytecode, which is why the same .class file runs on Windows, Linux or macOS.</span>${star("s1")}</p>
<ol>
<li><strong>Class loader</strong>: loads .class files into memory.</li>
<li><strong>Bytecode verifier</strong>: checks the bytecode is valid and safe.</li>
<li><strong>Execution engine</strong>: interprets the bytecode, while the <strong>JIT (Just-In-Time) compiler</strong> turns frequently run ("hot") bytecode into native machine code for speed.</li>
</ol>
<pre><code>Hello.java  --javac-->  Hello.class (bytecode)  --JVM-->  runs on any OS</code></pre>
<h3 id="h-jdk">1.3 JDK, JRE and JVM</h3>
<blockquote><p><strong>JDK</strong> = JRE + development tools (javac, java, javadoc, jdb)<br><strong>JRE</strong> = JVM + core class libraries</p></blockquote>
<p>${star("s2")}Only the <strong>JVM</strong> is platform specific. A developer installs the JDK; someone who only runs Java programs needs just the JRE.</p>
<table>
<thead><tr><th>Component</th><th>Contains</th><th>Needed by</th></tr></thead>
<tbody>
<tr><td>JVM</td><td>Class loader, verifier, execution engine, JIT</td><td>Everyone (it runs the bytecode)</td></tr>
<tr><td>JRE</td><td>JVM + core libraries (java.lang, java.util ...)</td><td>Users who run programs</td></tr>
<tr><td>JDK</td><td>JRE + javac, javadoc, jdb and other tools</td><td>Developers</td></tr>
</tbody>
</table>
<h3 id="h-memory">1.4 JVM memory areas</h3>
<ul>
<li><strong>Method area</strong>: class-level data such as static variables and method code.</li>
<li><strong>Heap</strong>: every object lives here; it is shared by all threads.</li>
<li><strong>Stack</strong>: one per thread; holds a frame for each method call, including its local variables.</li>
</ul>
<p><strong>Garbage collection</strong> reclaims heap memory used by objects that are no longer reachable from any live reference. You can request it with <code>System.gc()</code>, but you cannot force it.</p>

<h2 id="h-types">2. Data Types, Classes and Objects</h2>
<h3 id="h-primitives">2.1 Primitive data types</h3>
<p>Java has exactly eight primitive types. Their sizes are fixed on every platform, which is part of what makes Java portable.</p>
<table>
<thead><tr><th>Type</th><th>Size</th><th>Range or values</th><th>Default</th></tr></thead>
<tbody>
<tr><td>byte</td><td>8 bits</td><td>-128 to 127</td><td>0</td></tr>
<tr><td>short</td><td>16 bits</td><td>-32,768 to 32,767</td><td>0</td></tr>
<tr><td>int</td><td>32 bits</td><td>-2<sup>31</sup> to 2<sup>31</sup> - 1</td><td>0</td></tr>
<tr><td>long</td><td>64 bits</td><td>-2<sup>63</sup> to 2<sup>63</sup> - 1</td><td>0L</td></tr>
<tr><td>float</td><td>32 bits</td><td>about 7 decimal digits</td><td>0.0f</td></tr>
<tr><td>double</td><td>64 bits</td><td>about 15 decimal digits</td><td>0.0d</td></tr>
<tr><td>char</td><td>16 bits</td><td>Unicode characters</td><td>'\\u0000'</td></tr>
<tr><td>boolean</td><td>JVM dependent</td><td>true or false</td><td>false</td></tr>
</tbody>
</table>
<p class="formula-line"><span class="sticky-anchor" data-sticky="java-st-2"><strong>Range of an n-bit signed integer:</strong> -2<sup>(n-1)</sup> to 2<sup>(n-1)</sup> - 1</span></p>
<p><span class="sticky-anchor" data-sticky="java-st-3">Local variables get <strong>no default value</strong> and must be initialised before use</span>; instance variables get defaults (0, false or null).${star("s3")}</p>
<h3 id="h-classes">2.2 Classes and objects</h3>
<p>A <strong>class</strong> is a blueprint that defines the <em>fields</em> (state) and <em>methods</em> (behaviour) of its objects. An <strong>object</strong> is an instance of a class, created at run time with <code>new</code>, which allocates memory on the heap and calls a constructor.</p>
<pre><code>class Student {
    private String name;
    private int marks;

    Student(String name, int marks) {   // parameterised constructor
        this.name = name;
        this.marks = marks;
    }
}

Student s = new Student("Asha", 87);</code></pre>
<h3 id="h-constructors">2.3 Constructors</h3>
<ul>
<li>Same name as the class and <strong>no return type</strong>, not even <code>void</code>.</li>
<li>Runs exactly once, when the object is created.</li>
<li>Can be overloaded; one constructor can call another with <code>this(...)</code>, which must be the first statement.</li>
<li>If you write no constructor, the compiler adds a no-argument <strong>default constructor</strong>.</li>
</ul>
<p><span class="sticky-anchor" data-sticky="java-st-4">Once a class defines <em>any</em> constructor, the compiler no longer provides the default one</span>, so <code>new Student()</code> above would not compile.${star("s4")}</p>
<h3 id="h-static">2.4 The static keyword</h3>
<ul>
<li>A <strong>static field</strong> belongs to the class and is shared by all objects.</li>
<li>A <strong>static method</strong> can be called without an object and cannot use <code>this</code> or touch instance members directly.</li>
<li>A <strong>static block</strong> runs once, when the class is loaded.</li>
</ul>

<h2 id="h-oop">3. Object Oriented Programming Concepts</h2>
<p>The four pillars of OOP are <strong>encapsulation, inheritance, polymorphism and abstraction</strong>.</p>
<h3 id="h-encapsulation">3.1 Encapsulation</h3>
<p><strong>Definition:</strong> binding data and the methods that work on it into one unit, and hiding the data from outside access. Fields are <code>private</code> and are read or changed only through public <strong>getters and setters</strong>, which can validate values.</p>
<pre><code>class BankAccount {
    private double balance;

    public double getBalance() { return balance; }

    public void deposit(double amount) {
        if (amount &gt; 0) balance += amount;   // validation
    }
}</code></pre>
<h3 id="h-inheritance">3.2 Inheritance</h3>
<p>A subclass acquires the fields and methods of a superclass using <code>extends</code>, modelling an <strong>"is-a"</strong> relationship (a Dog <em>is an</em> Animal). <code>super</code> calls the superclass constructor or an overridden superclass method.</p>
<ul>
<li>Supported with classes: <strong>single, multilevel and hierarchical</strong> inheritance.</li>
<li><span class="sticky-anchor" data-sticky="java-st-5">Multiple inheritance of classes is <strong>not</strong> allowed, but a class can implement any number of interfaces.</span>${star("s6")}</li>
</ul>
<h3 id="h-polymorphism">3.3 Polymorphism</h3>
<p><strong>Polymorphism</strong> means "one name, many forms".</p>
<table>
<thead><tr><th></th><th>Overloading</th><th>Overriding</th></tr></thead>
<tbody>
<tr><td>Where</td><td>Same class</td><td>Subclass redefines a superclass method</td></tr>
<tr><td>Signature</td><td>Same name, different parameters</td><td>Same name and parameters</td></tr>
<tr><td>Resolved</td><td>Compile time (static binding)</td><td>Run time (dynamic method dispatch)</td></tr>
</tbody>
</table>
<p><span class="sticky-anchor" data-sticky="java-st-6">Overloading is decided at <strong>compile time</strong> from the argument types; overriding is decided at <strong>run time</strong> by dynamic method dispatch.</span>${star("s5")}</p>
<pre><code>Animal a = new Dog();   // superclass reference, subclass object
a.sound();              // calls Dog.sound() at run time</code></pre>
<h3 id="h-abstraction">3.4 Abstraction</h3>
<p><strong>Abstraction</strong> shows only the essential features of an object and hides how they work. An <strong>abstract class</strong> can mix abstract and concrete methods and cannot be instantiated. An <strong>interface</strong> declares methods that implementing classes must provide.</p>
<table>
<thead><tr><th>Abstract class</th><th>Interface</th></tr></thead>
<tbody>
<tr><td>Abstract and concrete methods</td><td>Abstract methods, plus default and static methods since Java 8</td></tr>
<tr><td>Instance variables and constructors allowed</td><td>Only public static final constants; no constructors</td></tr>
<tr><td>A class extends only one</td><td>A class can implement many</td></tr>
<tr><td>Members can have any access modifier</td><td>Methods are public by default</td></tr>
</tbody>
</table>
<h3 id="h-final">3.5 The final keyword</h3>
<p>A <code>final</code> variable can't be reassigned, a <code>final</code> method can't be overridden, and a <code>final</code> class can't be extended (String is a final class).</p>

<h2 id="h-strings">4. Strings and StringBuilder</h2>
<p>A <code>String</code> is an object of <code>java.lang.String</code> representing a sequence of characters. <span class="sticky-anchor" data-sticky="java-st-7">Strings are <strong>immutable</strong>: any method that seems to change a String actually returns a new String object.</span>${star("s7")} Immutability makes strings safe to share between threads and lets the JVM cache them.</p>
<h3 id="h-pool">4.1 The string constant pool</h3>
<p>String <strong>literals</strong> are stored once in the <strong>string constant pool</strong>, a special area of the heap, and shared. <code>new String("Java")</code> always creates a separate object outside the pool.</p>
<pre><code>String a = "Java";
String b = "Java";
String c = new String("Java");

a == b        // true: same pooled object
a == c        // false: different objects
a.equals(c)   // true: same characters</code></pre>
<p><span class="sticky-anchor" data-sticky="java-st-8">Compare string contents with <code>equals()</code>; <code>==</code> only checks whether two references point to the same object.</span>${star("s8")}</p>
<h3 id="h-string-methods">4.2 Common String methods</h3>
<table>
<thead><tr><th>Method</th><th>Returns</th></tr></thead>
<tbody>
<tr><td>length()</td><td>Number of characters</td></tr>
<tr><td>charAt(i)</td><td>Character at index i</td></tr>
<tr><td>substring(b, e)</td><td>Characters from index b up to, but not including, e</td></tr>
<tr><td>indexOf(s)</td><td>First index of s, or -1</td></tr>
<tr><td>toUpperCase(), trim()</td><td>A new, changed String</td></tr>
</tbody>
</table>
<h3 id="h-builder">4.3 StringBuilder and StringBuffer</h3>
<p><strong>StringBuilder</strong> is mutable: <code>append()</code>, <code>insert()</code>, <code>reverse()</code> and <code>delete()</code> change the same object, so building a string in a loop doesn't create a new object on every pass. <strong>StringBuffer</strong> has the same methods but is <strong>synchronized</strong>: thread safe, and slower.</p>
<p><span class="sticky-anchor" data-sticky="java-st-9">Concatenation runs left to right: <code>"5" + 3 + 2</code> gives <strong>"532"</strong>, but <code>3 + 2 + "5"</code> gives <strong>"55"</strong>.</span></p>

<h2 id="h-exceptions">5. Exception Handling</h2>
<p>An <strong>exception</strong> is an event that disrupts the normal flow of a program at run time. Every exception class descends from <code>Throwable</code>, which has two branches:</p>
<ul>
<li><strong>Error</strong>: serious problems a program shouldn't try to catch, such as OutOfMemoryError.</li>
<li><strong>Exception</strong>: conditions a program can handle.</li>
</ul>
<h3 id="h-checked">5.1 Checked and unchecked exceptions</h3>
<table>
<thead><tr><th></th><th>Checked</th><th>Unchecked</th></tr></thead>
<tbody>
<tr><td>Checked by</td><td>The compiler</td><td>Nothing at compile time</td></tr>
<tr><td>Must you handle it?</td><td>Yes: catch it or declare it with throws</td><td>No</td></tr>
<tr><td>Superclass</td><td>Exception</td><td>RuntimeException</td></tr>
<tr><td>Examples</td><td>IOException, SQLException</td><td>NullPointerException, ArithmeticException, ArrayIndexOutOfBoundsException</td></tr>
</tbody>
</table>
<p>${star("s9")}<span class="sticky-anchor" data-sticky="java-st-10">Checked exceptions must be caught or declared; unchecked ones extend RuntimeException.</span></p>
<h3 id="h-try">5.2 try, catch and finally</h3>
<pre><code>try {
    int result = 10 / 0;              // throws ArithmeticException
} catch (ArithmeticException e) {
    System.out.println("Cannot divide by zero");
} finally {
    System.out.println("Clean-up code");
}</code></pre>
<ul>
<li>A try can have several catch blocks, checked in order, so <strong>catch a subclass before its superclass</strong>.</li>
<li><span class="sticky-anchor" data-sticky="java-st-11"><code>finally</code> always runs, exception or not, unless the JVM exits first with <code>System.exit()</code>.</span>${star("s10")}</li>
</ul>
<h3 id="h-throw">5.3 throw and throws</h3>
<ul>
<li><code>throw</code> raises an exception object: <code>throw new IllegalArgumentException("Age must be positive");</code></li>
<li><code>throws</code> in a method signature declares the checked exceptions the method may pass to its caller.</li>
</ul>
<h3 id="h-custom">5.4 User-defined exceptions</h3>
<p>Extend <code>Exception</code> for a custom checked exception, or <code>RuntimeException</code> for an unchecked one, and pass the message to <code>super(message)</code>.</p>
<pre><code>class InsufficientBalanceException extends Exception {
    InsufficientBalanceException(String msg) { super(msg); }
}</code></pre>

<h2 id="h-collections">6. Collections Framework</h2>
<p>The <strong>Java Collections Framework</strong> (in <code>java.util</code>) is a set of interfaces and classes for storing and processing groups of objects. The main interfaces are <strong>List, Set, Queue and Map</strong>. Map belongs to the framework but does <em>not</em> extend Collection.</p>
<table>
<thead><tr><th>Interface</th><th>Ordering</th><th>Duplicates</th><th>Common classes</th></tr></thead>
<tbody>
<tr><td>List</td><td>Insertion order, index based</td><td>Allowed</td><td>ArrayList, LinkedList, Vector</td></tr>
<tr><td>Set</td><td>None (HashSet), sorted (TreeSet)</td><td>Not allowed</td><td>HashSet, LinkedHashSet, TreeSet</td></tr>
<tr><td>Queue</td><td>FIFO or priority</td><td>Allowed</td><td>PriorityQueue, ArrayDeque</td></tr>
<tr><td>Map</td><td>None (HashMap), sorted keys (TreeMap)</td><td>Unique keys</td><td>HashMap, LinkedHashMap, TreeMap</td></tr>
</tbody>
</table>
<h3 id="h-lists">6.1 ArrayList and LinkedList</h3>
<ul>
<li><strong>ArrayList</strong>: backed by a resizable array, so <code>get(i)</code> is O(1) but inserting in the middle is O(n).</li>
<li><strong>LinkedList</strong>: a doubly linked list, so adding or removing at either end is O(1) but <code>get(i)</code> is O(n).</li>
</ul>
<h3 id="h-hashmap">6.2 HashMap</h3>
<p>A <strong>HashMap</strong> stores key-value pairs in an array of buckets. The bucket is chosen from the key's <code>hashCode()</code>, and <code>equals()</code> finds the key inside the bucket.</p>
<p>${star("s11")}<span class="sticky-anchor" data-sticky="java-st-12">One null key, any number of null values, no insertion order, not synchronized.</span></p>
<p class="formula-line"><span class="sticky-anchor" data-sticky="java-st-13"><strong>Resize threshold = capacity × load factor</strong>. With the defaults (16 × 0.75) the map resizes after 12 entries.</span>${star("s12")}</p>
<p>When the threshold is passed, the HashMap <strong>doubles its capacity</strong> and rehashes every entry.</p>
<h3 id="h-iterate">6.3 Iterating over a collection</h3>
<pre><code>List&lt;String&gt; names = new ArrayList&lt;&gt;();
names.add("Ravi");
names.add("Meera");
for (String n : names) {
    System.out.println(n);
}</code></pre>
<p><span class="sticky-anchor" data-sticky="java-st-14">Removing items inside a for-each loop throws <strong>ConcurrentModificationException</strong>; use the Iterator's <code>remove()</code> instead.</span></p>

<h2 id="h-threads">7. Multithreading</h2>
<p>A <strong>thread</strong> is a lightweight unit of execution inside a process. Threads of one process share the heap, but each has its own stack. Multithreading lets a program do several tasks at once and stay responsive.</p>
<h3 id="h-create-threads">7.1 Creating threads</h3>
<ol>
<li>Extend <code>Thread</code> and override <code>run()</code>, or</li>
<li>Implement <code>Runnable</code> and pass the object to a <code>Thread</code> constructor. <strong>Preferred</strong>, because the class can still extend another class.</li>
</ol>
<pre><code>class Task implements Runnable {
    public void run() { System.out.println("Running"); }
}
Thread t = new Thread(new Task());
t.start();</code></pre>
<p><span class="sticky-anchor" data-sticky="java-st-15">Calling <code>run()</code> directly just runs it on the current thread. Only <code>start()</code> creates a new thread.</span>${star("s13")}</p>
<h3 id="h-lifecycle">7.2 Thread life cycle</h3>
<ol>
<li><strong>New</strong>: created, not started.</li>
<li><strong>Runnable</strong>: ready to run or running.</li>
<li><strong>Blocked</strong>: waiting for a lock.</li>
<li><strong>Waiting / Timed Waiting</strong>: waiting for another thread, or for a time limit (for example after <code>sleep()</code>).</li>
<li><strong>Terminated</strong>: <code>run()</code> has finished.</li>
</ol>
<h3 id="h-sync">7.3 Synchronization</h3>
<p>When several threads update shared data at once, the result can depend on timing: a <strong>race condition</strong>. <span class="sticky-anchor" data-sticky="java-st-16">A <code>synchronized</code> method takes the object's lock, so only one thread at a time can run any synchronized method of that object.</span>${star("s14")} A synchronized <em>block</em> locks only the statements that need it.</p>
<h3 id="h-thread-methods">7.4 Useful Thread methods</h3>
<table>
<thead><tr><th>Method</th><th>Purpose</th></tr></thead>
<tbody>
<tr><td>sleep(ms)</td><td>Pauses the current thread; it keeps any locks it holds</td></tr>
<tr><td>join()</td><td>Waits for another thread to finish</td></tr>
<tr><td>wait() / notify()</td><td>Releases the lock and waits / wakes a waiting thread; call inside synchronized code</td></tr>
<tr><td>setPriority(n)</td><td>Priority from 1 (MIN) to 10 (MAX); default 5</td></tr>
</tbody>
</table>

<h2 id="h-revision">Quick revision checklist</h2>
<ul class="checklist">
<li>Explain JDK vs JRE vs JVM with the two equations</li>
<li>List the eight primitive types with their sizes</li>
<li>Write a class with a parameterised constructor and getters/setters</li>
<li>Compare overloading and overriding (table above)</li>
<li>Compare abstract classes and interfaces</li>
<li>Predict the output of String == and equals() examples</li>
<li>Differentiate checked and unchecked exceptions with examples</li>
<li>Calculate a HashMap's resize threshold</li>
<li>Explain both ways to create a thread and the thread life cycle</li>
</ul>
`;

  const javaStickies = [
    { id: "java-st-1", kind: "tip", text: "Classic 2-mark question: \"Why is Java platform independent?\" Answer: bytecode + a JVM for every platform." },
    { id: "java-st-2", kind: "formula", text: "int (n = 32): -2^31 to 2^31 - 1, i.e. -2,147,483,648 to 2,147,483,647." },
    { id: "java-st-3", kind: "mistake", text: "Using a local variable before assigning it is a compile error, not a 0." },
    { id: "java-st-4", kind: "mistake", text: "Adding a parameterised constructor removes the free no-arg one. Write it yourself if you still need new Student()." },
    { id: "java-st-5", kind: "remember", text: "Classes: extend one. Interfaces: implement many." },
    { id: "java-st-6", kind: "tip", text: "Overloading vs overriding comes up almost every year. Draw the 3-row table." },
    { id: "java-st-7", kind: "remember", text: "Strings are set in stone; builders build." },
    { id: "java-st-8", kind: "mistake", text: "Comparing strings with == in an if condition. It can pass for literals and fail for new String()." },
    { id: "java-st-9", kind: "tip", text: "Output-prediction MCQs love this one. Work left to right." },
    { id: "java-st-10", kind: "remember", text: "Checked = Compiler checks. Unchecked = Runtime surprises." },
    { id: "java-st-11", kind: "tip", text: "If asked \"when does finally not run?\", the answer is System.exit()." },
    { id: "java-st-12", kind: "remember", text: "HashMap: 1 null key, many null values, no order, not thread safe." },
    { id: "java-st-13", kind: "formula", text: "threshold = capacity × load factor. 16 × 0.75 = 12; after resizing, 32 × 0.75 = 24." },
    { id: "java-st-14", kind: "mistake", text: "list.remove(x) inside for-each throws ConcurrentModificationException." },
    { id: "java-st-15", kind: "mistake", text: "t.run() compiles and runs, but there is no new thread. Use t.start()." },
    { id: "java-st-16", kind: "tip", text: "Define race condition in one line, then give the synchronized fix." },
  ];

  const javaSources = [
    { id: "s1", page: 1, quote: "The JVM does not understand Java source code; it executes bytecode, which is why the same .class file runs on every platform that has a JVM." },
    { id: "s2", page: 1, quote: "JDK = JRE + development tools (javac, java, javadoc, jdb). JRE = JVM + core class libraries." },
    { id: "s3", page: 2, quote: "Local variables are not given default values and must be initialised before use; instance variables get default values (0, false or null)." },
    { id: "s4", page: 2, quote: "If a class defines any constructor, the compiler no longer provides the default constructor." },
    { id: "s5", page: 3, quote: "Overloading is resolved at compile time from the argument types, whereas overriding is resolved at run time by dynamic method dispatch." },
    { id: "s6", page: 3, quote: "Java does not support multiple inheritance of classes, but a class can implement any number of interfaces." },
    { id: "s7", page: 4, quote: "String objects are immutable: every method that appears to modify a String returns a new String object." },
    { id: "s8", page: 4, quote: "Use equals() to compare the contents of two strings; == only checks whether two references point to the same object." },
    { id: "s9", page: 5, quote: "Checked exceptions are checked by the compiler and must be either caught or declared with throws; unchecked exceptions are subclasses of RuntimeException." },
    { id: "s10", page: 5, quote: "The finally block always executes, whether or not an exception is thrown, unless the JVM exits first by calling System.exit()." },
    { id: "s11", page: 6, quote: "A HashMap allows one null key and any number of null values, does not maintain insertion order and is not synchronized." },
    { id: "s12", page: 6, quote: "When the number of entries exceeds capacity × load factor, the HashMap doubles its capacity and rehashes every entry." },
    { id: "s13", page: 7, quote: "Calling run() directly executes the method on the current thread; only start() creates a new thread of execution." },
    { id: "s14", page: 7, quote: "A synchronized method acquires the lock on the object, so only one thread at a time can execute any synchronized method of that object." },
  ];

  window.NOTES_SEED = {
    java: { file: "Java_Unit1_OOP.pdf", html: javaHtml.trim(), stickies: javaStickies, sources: javaSources },
  };
})();
