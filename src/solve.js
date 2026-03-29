/**
 * Searches for a root by sampling the function across an interval.
 * @param {Function} f - The function to solve
 * @param {number} low - The start of the search range
 * @param {number} high - The end of the search range
 * @param {number} iterations - How many points to sample
 */
function solve(f, low, high, iterations = 10000) {
  let bestX = low;
  let minY  = Infinity;

  // Calculate the distance between each sample point
  const step = (high - low) / iterations;

  for ( let i = 0 ; i <= iterations ; i++ ) {
    const currentX = low + (step * i);
    const currentY = f(currentX);

    // If we hit NaN, skip this point and move on
    if ( isNaN(currentY) ) continue;

    // Keep track of the X that gets us closest to zero
    if ( currentY < minY ) {
      minY  = currentY;
      bestX = currentX;
    }
  }

  // Optional: If you want to get even closer, you could
  // run this again in a tighter range around bestX.
  return bestX;
}
