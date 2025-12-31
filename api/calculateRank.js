/**
 * Calculates the exponential cdf.
 *
 * @param {number} x The value.
 * @returns {number} The exponential cdf.
 */
function exponential_cdf(x) {
  return 1 - 2 ** -x;
}

/**
 * Calculates the log normal cdf.
 *
 * @param {number} x The value.
 * @returns {number} The log normal cdf.
 */
function log_normal_cdf(x) {
  // approximation
  return x / (1 + x);
}

/**
 * Calculates the users rank.
 *
 * @param {object} params Parameters on which the user's rank depends.
 * @param {boolean} params.all_commits Whether `include_all_commits` was used.
 * @param {number} params.commits Number of commits.
 * @param {number} params.prs The number of pull requests.
 * @param {number} params.issues The number of issues.
 * @param {number} params.reviews The number of reviews.
 * @param {number} params.repos Total repos contributed to.
 * @param {number} params.stars The number of stars.
 * @param {number} params.followers The number of followers.
 * @returns {{ level: string, percentile: number }} The users rank.
 */
const MEDIANS = {
  commits: { all: 1000, recent: 250 },
  prs: 50,
  issues: 25,
  reviews: 2,
  repos: 5,
  stars: 50,
  followers: 10
};

function getMedians(all_commits) {
  return {
    commits: all_commits ? MEDIANS.commits.all : MEDIANS.commits.recent,
    prs: MEDIANS.prs,
    issues: MEDIANS.issues,
    reviews: MEDIANS.reviews,
    repos: MEDIANS.repos,
    stars: MEDIANS.stars,
    followers: MEDIANS.followers
  };
}

function calculateRank({
  all_commits,
  commits,
  prs,
  issues,
  reviews,
  repos,
  stars,
  followers,
}) {
  const medians = getMedians(all_commits);
  const COMMITS_MEDIAN = medians.commits,
    COMMITS_WEIGHT = 2;
  const PRS_MEDIAN = medians.prs,
    PRS_WEIGHT = 3;
  const ISSUES_MEDIAN = medians.issues,
    ISSUES_WEIGHT = 1;
  const REVIEWS_MEDIAN = medians.reviews,
    REVIEWS_WEIGHT = 1;
  const REPOS_MEDIAN = medians.repos,
    REPOS_WEIGHT = 2;
  const STARS_MEDIAN = medians.stars,
    STARS_WEIGHT = 4;
  const FOLLOWERS_MEDIAN = medians.followers,
    FOLLOWERS_WEIGHT = 1;

  const TOTAL_WEIGHT =
    COMMITS_WEIGHT +
    PRS_WEIGHT +
    ISSUES_WEIGHT +
    REVIEWS_WEIGHT +
    REPOS_WEIGHT +
    STARS_WEIGHT +
    FOLLOWERS_WEIGHT;

  const THRESHOLDS = [1, 12.5, 25, 37.5, 50, 62.5, 75, 87.5, 100];
  const LEVELS = ["S", "A+", "A", "A-", "B+", "B", "B-", "C+", "C"];

  const rank =
    1 -
    (COMMITS_WEIGHT * exponential_cdf(commits / COMMITS_MEDIAN) +
      PRS_WEIGHT * exponential_cdf(prs / PRS_MEDIAN) +
      ISSUES_WEIGHT * exponential_cdf(issues / ISSUES_MEDIAN) +
      REVIEWS_WEIGHT * exponential_cdf(reviews / REVIEWS_MEDIAN) +
      REPOS_WEIGHT * log_normal_cdf(repos / REPOS_MEDIAN) +
      STARS_WEIGHT * log_normal_cdf(stars / STARS_MEDIAN) +
      FOLLOWERS_WEIGHT * log_normal_cdf(followers / FOLLOWERS_MEDIAN)) /
      TOTAL_WEIGHT;

const level = LEVELS[THRESHOLDS.findIndex((t) => rank * 100 <= t)];

  return { level, percentile: rank * 100 };
}

export { calculateRank, getMedians, MEDIANS };
export default calculateRank;
