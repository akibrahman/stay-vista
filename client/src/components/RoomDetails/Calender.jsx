import { DateRange } from "react-date-range";

const Calender = ({ value, reservations }) => {
  return (
    <DateRange
      ranges={[value, ...reservations]}
      // onChange={handleSelect}
      direction="vertical"
      showDateDisplay={false}
    />
  );
};

export default Calender;
