const { userRepo, skillRelationshipRepo, connectionRepo, sessionRepo } = require('./repositories');

/**
 * Normalizes skill names for matching.
 */
function normaliseSkills(skills) {
    if (!skills) return [];
    if (typeof skills === 'string') {
        try { skills = JSON.parse(skills); } catch (e) { return []; }
    }
    return Array.isArray(skills) ? skills : [];
}

/**
 * Gets UTC intervals for the upcoming week based on a user's schedule and timezone.
 */
function getUtcIntervals(availabilityArray, timeZone) {
    const intervals = [];
    if (!availabilityArray || availabilityArray.length === 0 || !timeZone) return intervals;
    
    // Validate timezone
    try {
        Intl.DateTimeFormat(undefined, { timeZone });
    } catch (e) {
        return intervals; // Invalid timezone
    }

    const now = new Date();
    // Reference date: start of today in local time (roughly)
    // We will scan the next 7 days (today + 6)
    
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
        const targetDate = new Date(now.getTime() + dayOffset * 24 * 60 * 60 * 1000);
        
        // Find what day of the week this targetDate is in the target timeZone
        const formatter = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit' });
        const parts = formatter.formatToParts(targetDate);
        
        const dayStr = parts.find(p => p.type === 'day').value;
        const monthStr = parts.find(p => p.type === 'month').value;
        const yearStr = parts.find(p => p.type === 'year').value;
        const weekdayStr = parts.find(p => p.type === 'weekday').value; // Mon, Tue, etc.
        
        const dayMap = { 'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6 };
        const localDayOfWeek = dayMap[weekdayStr];
        
        const dayAvailabilities = availabilityArray.filter(a => a.day_of_week === localDayOfWeek);
        
        for (const avail of dayAvailabilities) {
            // Build a string that Node can parse as if it were UTC, then subtract the offset
            // We need to parse YYYY-MM-DDTHH:mm:00 in that timezone.
            // But JS Date doesn't easily parse timezone strings except Z or offsets.
            // Let's find the offset for this specific date and time in the given timezone.
            
            const localStartStr = `${yearStr}-${monthStr}-${dayStr}T${avail.start_time}`;
            const localEndStr = `${yearStr}-${monthStr}-${dayStr}T${avail.end_time}`;
            
            // To find the offset, we can use a binary search or simply formatting a UTC date 
            // until we match, but an easier way is to use the formatter on a rough UTC guess.
            // Let's create a rough date:
            const roughStart = new Date(localStartStr + 'Z'); 
            const offsetMsStart = getOffsetMs(roughStart, timeZone);
            const utcStart = new Date(roughStart.getTime() - offsetMsStart);
            
            const roughEnd = new Date(localEndStr + 'Z');
            const offsetMsEnd = getOffsetMs(roughEnd, timeZone);
            const utcEnd = new Date(roughEnd.getTime() - offsetMsEnd);
            
            if (utcStart < utcEnd) {
                intervals.push({ start: utcStart.getTime(), end: utcEnd.getTime() });
            }
        }
    }
    
    return intervals;
}

function getOffsetMs(date, timeZone) {
    // Format the date as UTC and as the target timezone, then compare
    const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
    const tzDate = new Date(date.toLocaleString('en-US', { timeZone }));
    return tzDate.getTime() - utcDate.getTime();
}

/**
 * Calculates overlap between two sets of intervals (in minutes).
 */
function calculateOverlapMinutes(intervalsA, intervalsB) {
    let overlapMs = 0;
    for (const a of intervalsA) {
        for (const b of intervalsB) {
            const maxStart = Math.max(a.start, b.start);
            const minEnd = Math.min(a.end, b.end);
            if (maxStart < minEnd) {
                overlapMs += (minEnd - maxStart);
            }
        }
    }
    return Math.floor(overlapMs / 60000);
}

/**
 * The main matching engine.
 */
async function calculateMatches(currentUser, allUsers, availabilitiesMap, relationships) {
    const mine = normaliseSkills(currentUser.skills);
    const myTeach = mine.filter(s => s.type === 'teach');
    const myLearn = mine.filter(s => s.type === 'learn');
    const myAvail = availabilitiesMap[currentUser.id] || [];
    const myTimezone = myAvail.length > 0 ? myAvail[0].timezone : (currentUser.timezone || 'UTC');
    const myIntervals = getUtcIntervals(myAvail, myTimezone);
    
    // Create relationship map
    const relMap = {};
    for (const rel of relationships) {
        if (!relMap[rel.source_skill.toLowerCase()]) relMap[rel.source_skill.toLowerCase()] = [];
        relMap[rel.source_skill.toLowerCase()].push({ related: rel.related_skill.toLowerCase(), weight: parseFloat(rel.weight) });
        
        if (rel.relationship_type === 'related') { // bi-directional
            if (!relMap[rel.related_skill.toLowerCase()]) relMap[rel.related_skill.toLowerCase()] = [];
            relMap[rel.related_skill.toLowerCase()].push({ related: rel.source_skill.toLowerCase(), weight: parseFloat(rel.weight) });
        }
    }

    const matches = [];

    for (const user of allUsers) {
        if (user.id === currentUser.id || user.role === 'admin') continue;

        const theirs = normaliseSkills(user.skills);
        const theirTeach = theirs.filter(s => s.type === 'teach');
        const theirLearn = theirs.filter(s => s.type === 'learn');

        let reasons = [];
        
        // 1. Skill Compatibility (40%) & Reciprocity (20%) & Proficiency (10%)
        let skillScore = 0;
        let recScore = 0;
        let profScore = 0;
        
        const profLevels = { 'Beginner': 1, 'Intermediate': 2, 'Advanced': 3, 'Expert': 4 };

        const matchedTeach = [];
        const matchedLearn = [];
        let exactTeachMatches = 0;
        let exactLearnMatches = 0;

        // Evaluate what they can teach ME
        for (const ml of myLearn) {
            const mlName = ml.name.toLowerCase();
            let bestWeight = 0;
            let bestTheirs = null;
            
            for (const tt of theirTeach) {
                const ttName = tt.name.toLowerCase();
                if (mlName === ttName) {
                    bestWeight = 1.0;
                    bestTheirs = tt;
                    exactTeachMatches++;
                    break;
                }
                // Check related
                const rels = relMap[ttName] || [];
                const related = rels.find(r => r.related === mlName);
                if (related && related.weight > bestWeight) {
                    bestWeight = related.weight;
                    bestTheirs = tt;
                }
            }
            
            if (bestWeight > 0) {
                skillScore += bestWeight * 20; // up to 20 pts for my learning
                matchedTeach.push({ my: ml, theirs: bestTheirs, weight: bestWeight });
                
                // Proficiency check
                const myLevel = profLevels[ml.level] || 1;
                const theirLevel = profLevels[bestTheirs.level] || 3;
                if (theirLevel >= myLevel) {
                    profScore += 5; // Good fit
                } else {
                    profScore += 2; // Weak fit
                }
            }
        }

        // Evaluate what I can teach THEM
        for (const tl of theirLearn) {
            const tlName = tl.name.toLowerCase();
            let bestWeight = 0;
            let bestMine = null;
            
            for (const mt of myTeach) {
                const mtName = mt.name.toLowerCase();
                if (tlName === mtName) {
                    bestWeight = 1.0;
                    bestMine = mt;
                    exactLearnMatches++;
                    break;
                }
                // Check related
                const rels = relMap[mtName] || [];
                const related = rels.find(r => r.related === tlName);
                if (related && related.weight > bestWeight) {
                    bestWeight = related.weight;
                    bestMine = mt;
                }
            }
            
            if (bestWeight > 0) {
                skillScore += bestWeight * 20; // up to 20 pts for their learning
                matchedLearn.push({ my: bestMine, theirs: tl, weight: bestWeight });
                
                // Proficiency check
                const theirLevel = profLevels[tl.level] || 1;
                const myLevel = profLevels[bestMine.level] || 3;
                if (myLevel >= theirLevel) {
                    profScore += 5;
                } else {
                    profScore += 2;
                }
            }
        }

        // Cap scores
        skillScore = Math.min(skillScore, 40);
        profScore = Math.min(profScore, 10);
        
        if (exactTeachMatches > 0 && exactLearnMatches > 0) {
            recScore = 20;
        } else if (matchedTeach.length > 0 && matchedLearn.length > 0) {
            recScore = 15;
        } else if (matchedTeach.length > 0 || matchedLearn.length > 0) {
            recScore = 5;
        }

        // Generate skill reasons
        if (matchedTeach.length > 0) {
            const exactNames = matchedTeach.filter(m => m.weight === 1.0).map(m => m.theirs.name);
            const relatedNames = matchedTeach.filter(m => m.weight < 1.0).map(m => m.theirs.name);
            if (exactNames.length > 0) reasons.push(`They teach ${exactNames.join(', ')}`);
            if (relatedNames.length > 0) reasons.push(`They teach related skills (${relatedNames.join(', ')})`);
        }
        if (matchedLearn.length > 0) {
            const exactNames = matchedLearn.filter(m => m.weight === 1.0).map(m => m.theirs.name);
            if (exactNames.length > 0) reasons.push(`They want to learn ${exactNames.join(', ')}`);
        }

        // 2. Availability Overlap (15%)
        let availScore = 0;
        const theirAvail = availabilitiesMap[user.id] || [];
        if (myAvail.length > 0 && theirAvail.length > 0) {
            const theirTimezone = theirAvail.length > 0 ? theirAvail[0].timezone : (user.timezone || 'UTC');
            const theirIntervals = getUtcIntervals(theirAvail, theirTimezone);
            const overlapMins = calculateOverlapMinutes(myIntervals, theirIntervals);
            if (overlapMins > 0) {
                availScore = Math.min((overlapMins / 60) * 5, 15); // max 15 points (3 hours)
                const hours = Math.floor(overlapMins / 60);
                const mins = overlapMins % 60;
                reasons.push(`${hours > 0 ? hours + 'h ' : ''}${mins > 0 ? mins + 'm ' : ''}availability overlap`);
            }
        } else if (myAvail.length === 0 || theirAvail.length === 0) {
            // Neutral availability if unspecified
            availScore = 5;
        }

        // 3. Rating & Reviews (5% + 3%)
        let ratingScore = 0;
        let reviewScore = 0;
        const rating = Number(user.rating || 0);
        const reviewCount = Number(user.review_count || 0);
        
        if (rating > 0 && reviewCount > 0) {
            ratingScore = (rating / 5) * 5;
            reviewScore = Math.min((reviewCount / 10) * 3, 3); // max 3 pts for 10+ reviews
            if (rating >= 4.5) {
                reasons.push(`${rating.toFixed(1)}★ from ${reviewCount} reviews`);
            }
        } else {
            // New user fairness - don't heavily penalize missing reviews
            ratingScore = 3;
            reviewScore = 2;
        }

        // 4. Activity & Interaction (3% + 4%)
        let activityScore = 3; // default active
        let interactionScore = 0;
        
        // Sum total score
        let totalScore = skillScore + recScore + profScore + availScore + ratingScore + reviewScore + activityScore + interactionScore;
        totalScore = Math.min(Math.round(totalScore), 100);

        if (totalScore > 0 && skillScore > 0) {
            const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'User';
            matches.push({
                id: user.id,
                name: fullName,
                initials: fullName.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase(),
                rating: rating,
                review_count: reviewCount,
                avatar_url: user.avatar_url || null,
                matchPercentage: totalScore,
                reasons: reasons,
                canTeachYou: matchedTeach.map(m => m.theirs.name),
                youCanTeach: matchedLearn.map(m => m.my.name),
                skills: theirs
            });
        }
    }

    return matches.sort((a, b) => b.matchPercentage - a.matchPercentage);
}

module.exports = {
    normaliseSkills,
    calculateMatches
};
