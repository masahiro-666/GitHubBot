import jsonfile from "jsonfile";
import moment from "moment";
import simpleGit from "simple-git";
import random from "random";
import { promisify } from "util";

// Configuration
const CONFIG = {
  dataFile: "./data.json",
  commitCount: 100,
  maxWeeks: 54,
  maxDays: 6,
  commitMessage: "Update data",
  skipWeekends: false,
  minCommitsPerDay: 1,
  maxCommitsPerDay: 3,
  intensityPattern: 'random' // 'random', 'consistent', 'burst'
};

const git = simpleGit();
const writeFileAsync = promisify(jsonfile.writeFile);

// Utility functions
const isWeekend = (date) => {
  const dayOfWeek = moment(date).day();
  return dayOfWeek === 0 || dayOfWeek === 6; // Sunday or Saturday
};

const generateCommitPattern = (totalCommits) => {
  const commits = [];
  
  switch (CONFIG.intensityPattern) {
    case 'consistent':
      // Spread commits evenly across the year
      for (let i = 0; i < totalCommits; i++) {
        const weekOffset = Math.floor((i / totalCommits) * CONFIG.maxWeeks);
        const dayOffset = (i * 3) % CONFIG.maxDays; // Vary days
        commits.push({ week: weekOffset, day: dayOffset });
      }
      break;
      
    case 'burst':
      // Create periods of high activity
      let remaining = totalCommits;
      while (remaining > 0) {
        const burstSize = Math.min(random.int(5, 15), remaining);
        const baseWeek = random.int(0, CONFIG.maxWeeks - 2);
        
        for (let i = 0; i < burstSize; i++) {
          const week = baseWeek + Math.floor(i / 7);
          const day = i % CONFIG.maxDays;
          commits.push({ week, day });
          remaining--;
        }
        
        if (remaining > 0) {
          // Add some gap between bursts
          const gap = random.int(2, 8);
          // Gap is handled by the random selection above
        }
      }
      break;
      
    default: // 'random'
      for (let i = 0; i < totalCommits; i++) {
        commits.push({
          week: random.int(0, CONFIG.maxWeeks),
          day: random.int(0, CONFIG.maxDays)
        });
      }
  }
  
  return commits;
};

const createCommitDate = (weekOffset, dayOffset) => {
  const date = moment()
    .subtract(1, "y")
    .add(1, "d")
    .add(weekOffset, "w")
    .add(dayOffset, "d");
    
  // Skip weekends if configured
  if (CONFIG.skipWeekends && isWeekend(date)) {
    return createCommitDate(weekOffset, (dayOffset + 1) % CONFIG.maxDays);
  }
  
  return date;
};

const makeCommit = async (date, commitNumber, totalCommits) => {
  try {
    const dateString = date.format();
    const data = {
      date: dateString,
      commit: commitNumber,
      total: totalCommits,
      timestamp: Date.now()
    };

    await writeFileAsync(CONFIG.dataFile, data);
    
    await git.add([CONFIG.dataFile]);
    await git.commit(`${CONFIG.commitMessage} - ${dateString}`, { "--date": dateString });
    
    console.log(`✓ Commit ${commitNumber}/${totalCommits}: ${dateString}`);
    
    return true;
  } catch (error) {
    console.error(`✗ Failed to create commit ${commitNumber}:`, error.message);
    return false;
  }
};

const makeCommits = async (totalCommits = CONFIG.commitCount) => {
  console.log(`🚀 Starting to create ${totalCommits} commits...`);
  console.log(`📊 Pattern: ${CONFIG.intensityPattern}`);
  console.log(`📅 Skip weekends: ${CONFIG.skipWeekends}`);
  
  try {
    // Check if we're in a git repository
    const isRepo = await git.checkIsRepo();
    if (!isRepo) {
      console.error("❌ Not in a git repository. Please run 'git init' first.");
      return;
    }

    // Generate commit pattern
    const commitPattern = generateCommitPattern(totalCommits);
    
    // Sort commits by date to maintain chronological order
    const sortedCommits = commitPattern
      .map((commit, index) => ({
        ...commit,
        date: createCommitDate(commit.week, commit.day),
        index: index + 1
      }))
      .sort((a, b) => a.date.valueOf() - b.date.valueOf());

    // Create commits
    let successCount = 0;
    for (const commit of sortedCommits) {
      const success = await makeCommit(commit.date, commit.index, totalCommits);
      if (success) successCount++;
      
      // Add small delay to avoid overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Push all commits
    console.log(`📤 Pushing ${successCount} commits to remote...`);
    await git.push();
    
    console.log(`🎉 Successfully created ${successCount}/${totalCommits} commits!`);
    
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
};

// Run the script
makeCommits();
