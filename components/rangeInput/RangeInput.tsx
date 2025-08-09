import styles from "./style.module.css";
import { Text } from "@chakra-ui/react";

interface RangeInputProps {
  fontValue: number;
  lineValue: number;
  setFontValue: (value: number) => void;
  setLineValue: (value: number) => void;
}

const MIN_FONT = 8;
const MAX_FONT = 24;
const STEP_FONT = 1;

const MIN_WIDTH = 200;
const MAX_WIDTH = 1000;
const STEP_WIDTH = 20;

const RangeInput = ({
  fontValue,
  lineValue,
  setFontValue,
  setLineValue,
}: RangeInputProps) => {
  const handleFontChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);
    setFontValue(Math.max(Math.min(value, MAX_FONT), MIN_FONT));
  };

  const handleLineChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);
    setLineValue(Math.max(Math.min(value, MAX_WIDTH), MIN_WIDTH));
  };

  const fontPercent = ((fontValue - MIN_FONT) / (MAX_FONT - MIN_FONT)) * 100;
  const widthPercent =
    ((lineValue - MIN_WIDTH) / (MAX_WIDTH - MIN_WIDTH)) * 100;

  const left = Math.min(fontPercent, widthPercent);
  const right = Math.max(fontPercent, widthPercent);
  const trackWidth = right - left;

  const isConflict = fontValue * 10 > lineValue;

  return (
    <div className={styles.container}>
      <div className={styles.rangeGroupe}>
        <div className={styles.rangeInputGroupe}>
          <div className={styles.InputsDefaultMinGroup}>
            <div className={styles.line}>Строка</div>
            <div className={styles.GroupMin}>
              <div className={styles.RectangleMin} />
              <div className={styles.MinSum}>{lineValue}px</div>
            </div>
          </div>
          <div className={styles.InputsDefaultMaxGroup}>
            <div className={styles.font}>Шрифт</div>
            <div className={styles.GroupMax}>
              <div className={styles.RectangleMax} />
              <div className={styles.MaxSum}>{fontValue}px</div>
            </div>
          </div>
          <div className={styles.Dash}>-</div>
        </div>

        <div className={styles.ScaleLineContainer}>
          <div
            className={styles.FilledTrack}
            style={{
              left: `${left}%`,
              width: `${trackWidth}%`,
            }}
          />
          <input
            className={styles.ScaleLine}
            type="range"
            min={MIN_WIDTH}
            max={MAX_WIDTH}
            step={STEP_WIDTH}
            value={lineValue}
            onChange={handleLineChange}
          />
          <input
            className={styles.ScaleLine}
            type="range"
            min={MIN_FONT}
            max={MAX_FONT}
            step={STEP_FONT}
            value={fontValue}
            onChange={handleFontChange}
          />
        </div>

        <Text className={styles.FontRange}>Ширина строки и шрифт</Text>

        {isConflict && (
          <Text color="red" fontSize="12px" mt="2">
            ⚠️ Шрифт слишком большой для текущей ширины строки
          </Text>
        )}
      </div>
    </div>
  );
};

export default RangeInput;
