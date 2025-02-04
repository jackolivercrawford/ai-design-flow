#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Directories to exclude entirely from the tree (except node_modules and .next, which we list only as a folder)
const excludeDirs = ['.git'];

// File extensions to include for content output, plus specific files to always include
const fileExtensionsToInclude = ['.tsx', '.ts', '.html', '.css'];
const specificFiles = ['.gitignore', 'tsconfig.json', 'package.json', '.env'];

/**
 * Custom sort function to mimic Cursor’s left-hand file explorer ordering:
 * - Directories come first, then files, both sorted alphabetically.
 *
 * @param {string} a - The first file or folder name.
 * @param {string} b - The second file or folder name.
 * @param {string} dir - The current directory path.
 * @returns {number} - Sorting value.
 */
function sortItems(a, b, dir) {
  const aPath = path.join(dir, a);
  const bPath = path.join(dir, b);
  const aIsDir = fs.statSync(aPath).isDirectory();
  const bIsDir = fs.statSync(bPath).isDirectory();

  // Place directories before files
  if (aIsDir && !bIsDir) return -1;
  if (!aIsDir && bIsDir) return 1;
  // If both are of the same type, sort alphabetically
  return a.localeCompare(b);
}

/**
 * Recursively generate a tree structure string for a given directory.
 * Uses branch characters for a tree view.
 * 
 * For the "node_modules" and ".next" directories, it prints the folder name but does not traverse its contents.
 *
 * @param {string} dir - The directory to scan.
 * @param {string} prefix - The string prefix used for indentation.
 * @returns {string} - The tree structure as a string.
 */
function generateTree(dir, prefix = '') {
  let tree = '';
  let items = fs.readdirSync(dir);

  // Sort items using our custom sort function
  items.sort((a, b) => sortItems(a, b, dir));

  // Filter out directories that should be completely excluded (e.g., .git)
  items = items.filter(item => !excludeDirs.includes(item));

  const lastIndex = items.length - 1;
  items.forEach((item, index) => {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    const isDirectory = stat.isDirectory();
    const connector = index === lastIndex ? '└── ' : '├── ';
    tree += prefix + connector + item + "\n";

    if (isDirectory) {
      const newPrefix = prefix + (index === lastIndex ? '    ' : '│   ');
      // For "node_modules" or ".next", show its name only with a placeholder
      if (item === 'node_modules' || item === '.next') {
        tree += newPrefix + '└── ' + '... (contents hidden)' + "\n";
      } else {
        tree += generateTree(fullPath, newPrefix);
      }
    }
  });
  return tree;
}

/**
 * Recursively collect files (whose extension is in fileExtensionsToInclude
 * or whose basename matches one of specificFiles) in the order they appear in the tree.
 * Skips directories that are in excludeDirs and does not traverse into "node_modules" or ".next".
 *
 * @param {string} dir - The directory to scan.
 * @param {string[]} collectedFiles - An array to accumulate matching file paths.
 * @returns {string[]} - The array of file paths in tree order.
 */
function collectFiles(dir, collectedFiles = []) {
  let items = fs.readdirSync(dir);

  // Sort items in the same way as in generateTree
  items.sort((a, b) => sortItems(a, b, dir));

  items.forEach(item => {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      // Skip directories that are to be excluded completely
      if (!excludeDirs.includes(item)) {
        // For "node_modules" and ".next", do not traverse further (but they appear in the tree)
        if (item === 'node_modules' || item === '.next') {
          // Do nothing here; we show the folder in the tree but do not collect its files.
        } else {
          collectFiles(fullPath, collectedFiles);
        }
      }
    } else {
      const ext = path.extname(item);
      if (fileExtensionsToInclude.includes(ext) || specificFiles.includes(item)) {
        collectedFiles.push(fullPath);
      }
    }
  });
  return collectedFiles;
}

/**
 * Generates the codebase.txt file:
 * - Writes a tree structure of all files (showing node_modules and .next but not their contents) with "AI-DESIGN-FLOW" at the top
 * - Then appends the file paths and file contents of the specified file types,
 *   in the same order (top-to-bottom) as they appear in the tree.
 */
function generateCodebaseFile() {
  // Use the current working directory (project root)
  const rootDir = process.cwd();
  let output = '';

  // Generate and append the tree structure header
  output += 'Codebase Tree Structure:\n';
  output += '========================\n';
  // Add the "AI-DESIGN-FLOW" title at the very top
  output += 'AI-DESIGN-FLOW\n';
  // Generate the rest of the tree with an indentation under the root title
  output += generateTree(rootDir, '  ');
  output += '\n\n';

  // Append the contents of selected files
  output += 'File Contents:\n';
  output += '==============\n\n';
  const filesToInclude = collectFiles(rootDir);
  // Note: We no longer re-sort filesToInclude, so they remain in tree order.

  filesToInclude.forEach(filePath => {
    output += `----- ${filePath} -----\n`;
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      output += content + "\n\n";
    } catch (error) {
      output += 'Error reading file.\n\n';
    }
  });

  // Write the output to codebase.txt in the root folder
  const outputPath = path.join(rootDir, 'codebase.txt');
  fs.writeFileSync(outputPath, output, 'utf-8');
  console.log(`Codebase file generated at ${outputPath}`);
}

// Run the script
generateCodebaseFile();