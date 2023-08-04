import { differenceInCalendarDays, eachDayOfInterval, getDay, getMonth, getYear } from 'date-fns';
import {
    checkTimeMinMax,
    getDate,
    getDateForCompare,
    getDaysInBetween,
    getTimeObj,
    getZonedDate,
    isDateAfter,
    isDateBefore,
    isDateEqual,
    resetDateTime,
    setTimeValue,
} from '@/utils/date-utils';
import { useDefaults } from '@/composables/defaults';
import { convertType } from '@/utils/util';

import type { InternalModuleValue, ArrMapValues, ArrMapValue } from '@/interfaces';
import type { PickerBasePropsType, AllPropsType } from '@/props';

export const useValidation = (props: PickerBasePropsType | AllPropsType) => {
    const { defaultedFilters } = useDefaults(props);
    const getMapKey = (date: Date | string | number) => {
        const d = resetDateTime(getTzDate(getDate(date))).toISOString();
        const [stringVal] = d.split('T');
        return stringVal;
    };
    const getTzDate = (date: Date) => getZonedDate(date, props.timezone);
    const validateDate = (date: Date) => {
        const aboveMax = props.maxDate ? isDateAfter(getTzDate(date), getTzDate(getDate(props.maxDate))) : false;
        const bellowMin = props.minDate ? isDateBefore(getTzDate(date), getTzDate(getDate(props.minDate))) : false;
        const inDisableArr = matchDate(
            date,
            (props as PickerBasePropsType).arrMapValues?.disabledDates
                ? (props as PickerBasePropsType).arrMapValues.disabledDates
                : props.disabledDates,
        );
        const disabledMonths = defaultedFilters.value.months.map((month) => +month);
        const inDisabledMonths = disabledMonths.includes(getMonth(date));
        const weekDayDisabled = props.disabledWeekDays.length
            ? props.disabledWeekDays.some((day) => +day === getDay(date))
            : false;

        const notInSpecific = checkAllowedDates(date);

        const dateYear = getYear(date);

        const outOfYearRange = dateYear < +props.yearRange[0] || dateYear > +props.yearRange[1];

        return !(
            aboveMax ||
            bellowMin ||
            inDisableArr ||
            inDisabledMonths ||
            outOfYearRange ||
            weekDayDisabled ||
            notInSpecific
        );
    };

    const validateMinDate = (month: number, year: number): boolean => {
        return (
            isDateBefore(...getDateForCompare(props.minDate, month, year)) ||
            isDateEqual(...getDateForCompare(props.minDate, month, year))
        );
    };

    const validateMaxDate = (month: number, year: number): boolean => {
        return (
            isDateAfter(...getDateForCompare(props.maxDate, month, year)) ||
            isDateEqual(...getDateForCompare(props.maxDate, month, year))
        );
    };

    const validateBothMinAndMax = (month: number, year: number, isNext: boolean) => {
        let valid = false;
        if (props.maxDate && isNext && validateMaxDate(month, year)) {
            valid = true;
        }
        if (props.minDate && !isNext && validateMinDate(month, year)) {
            valid = true;
        }
        return valid;
    };

    const matchDate = (
        date: Date,
        pattern: Date[] | string[] | number[] | ((date: Date) => boolean) | ArrMapValue,
    ): boolean => {
        if (!date) return true;
        if (pattern instanceof Map) {
            return !!pattern.get(getMapKey(date));
        }
        if (Array.isArray(pattern)) {
            return pattern.some((includedDate) => isDateEqual(getTzDate(getDate(includedDate)), getTzDate(date)));
        }
        return pattern ? pattern(getDate(JSON.parse(JSON.stringify(date)))) : false;
    };

    const validateMonthYearInRange = (month: number, year: number, isNext: boolean, preventNav: boolean): boolean => {
        let valid = false;
        if (preventNav) {
            if (props.minDate && props.maxDate) {
                valid = validateBothMinAndMax(month, year, isNext);
            } else if (props.minDate && validateMinDate(month, year)) {
                valid = true;
            } else if (props.maxDate && validateMaxDate(month, year)) {
                valid = true;
            }
        } else {
            valid = true;
        }
        return valid;
    };

    const checkAllowedDates = (date: Date) => {
        if (Array.isArray(props.allowedDates) && !props.allowedDates?.length) return true;
        if ((props as PickerBasePropsType).arrMapValues?.allowedDates)
            return !matchDate(date, (props as PickerBasePropsType).arrMapValues?.allowedDates);
        if (props.allowedDates?.length)
            return !props.allowedDates?.some((dateVal) => isDateEqual(getTzDate(getDate(dateVal)), getTzDate(date)));
        return false;
    };

    /**
     * Check if date is between max and min date, or if it is included in filters
     */
    const isDisabled = (date: Date): boolean => {
        return !validateDate(date);
    };

    // Check if there are disabled dates for a given range
    const isDateRangeAllowed = (range: Date[]): boolean => {
        const datesInBetween = eachDayOfInterval({ start: range[0], end: range[1] });
        return !datesInBetween.some((date) => isDisabled(date));
    };

    // If min or max range is set, validate given range
    const checkMinMaxRange = (secondDate: Date, modelValue: InternalModuleValue, index = 0): boolean => {
        if (Array.isArray(modelValue) && modelValue[index]) {
            const absoluteDiff = differenceInCalendarDays(secondDate, modelValue[index]);
            const daysInBetween = getDaysInBetween(modelValue[index], secondDate);
            const disabledDates =
                daysInBetween.length === 1 ? 0 : daysInBetween.filter((date) => isDisabled(date)).length;
            const diff = Math.abs(absoluteDiff) - disabledDates;
            if (props.minRange && props.maxRange) return diff >= +props.minRange && diff <= +props.maxRange;
            if (props.minRange) return diff >= +props.minRange;
            if (props.maxRange) return diff <= +props.maxRange;
        }
        return true;
    };

    const datesArrToMap = (datesArr: (Date | string | number)[]): Map<string, boolean> => {
        return new Map(datesArr.map((date) => [getMapKey(date), true]));
    };

    const shouldMap = (arr: any): arr is Date[] | boolean => {
        return Array.isArray(arr) && arr.length > 0;
    };

    const mapDatesArrToMap = (arrMapValues: ArrMapValues) => {
        if (shouldMap(props.allowedDates)) {
            arrMapValues.allowedDates = datesArrToMap(props.allowedDates);
        }
        if (shouldMap(props.highlight)) {
            arrMapValues.highlightedDates = datesArrToMap(props.highlight);
        }
        if (shouldMap(props.disabledDates)) {
            arrMapValues.disabledDates = datesArrToMap(props.disabledDates);
        }
    };

    // Check if we need to do a time validation
    const skipTimeValidation = () => {
        return !props.enableTimePicker || props.monthPicker || props.yearPicker || props.ignoreTimeValidation;
    };

    // Return set time for a given date or array of dates
    const getSetTimeValue = (date: Date | Date[]) => {
        if (Array.isArray(date)) {
            return [date[0] ? setTimeValue(date[0]) : null, date[1] ? setTimeValue(date[1]) : null];
        }
        return setTimeValue(date);
    };

    // Validate time
    const isValidTime = (date: InternalModuleValue): boolean => {
        let isValid = true;
        if (!date) return true;
        if (skipTimeValidation()) return true;

        const selectedDateTime = !props.minDate && !props.maxDate ? getSetTimeValue(date) : date;

        if (props.maxTime || props.maxDate) {
            isValid = checkTimeMinMax(props.maxTime, props.maxDate, 'max', convertType(selectedDateTime), isValid);
        }

        if (props.minTime || props.minDate) {
            isValid = checkTimeMinMax(props.minTime, props.minDate, 'min', convertType(selectedDateTime), isValid);
        }
        if (props.disabledTimes) {
            const param = Array.isArray(date)
                ? [getTimeObj(date[0]), date[1] ? getTimeObj(date[1]) : undefined]
                : getTimeObj(date);
            isValid = !props.disabledTimes(param);
        }
        return isValid;
    };

    return {
        isDisabled,
        validateDate,
        validateMonthYearInRange,
        isDateRangeAllowed,
        checkMinMaxRange,
        matchDate,
        mapDatesArrToMap,
        isValidTime,
    };
};