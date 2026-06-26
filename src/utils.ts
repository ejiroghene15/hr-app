// Get number of days based on start and end date
export const getDays = (startDate: Date, endDate: Date) => {
  const diffTime = endDate.getTime() - startDate.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // inclusive
};
