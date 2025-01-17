import { DatePicker, DatePickerProps } from '@fluentui/react-datepicker-compat';
import { CalendarCancelRegular } from '@fluentui/react-icons';
import { isDate, isFunction, isNullOrEmptyString } from '@kwiz/common';
import * as React from 'react';
import { useKWIZFluentContext } from '../helpers/context';


interface IProps extends DatePickerProps {
    onOK?: () => void;
    onCancel?: () => void;
}
export const DatePickerEx: React.FunctionComponent<React.PropsWithChildren<IProps>> = (props) => {
    const ctx = useKWIZFluentContext();
    const [showClear, setShowClear] = React.useState(isDate(props.value));
    const reset = React.useCallback(() => {
        setShowClear(false);
        if (isFunction(props.onSelectDate)) props.onSelectDate(undefined);
    }, [showClear]);

    return (
        <DatePicker appearance={ctx.inputAppearance} mountNode={ctx.mountNode} {...props}
            onSelectDate={(date) => {
                setShowClear(isDate(date));
                if (isFunction(props.onSelectDate)) props.onSelectDate(date);
            }}
            onChange={(e, data) => {
                setShowClear(!isNullOrEmptyString(data.value));
                if (isFunction(props.onChange)) props.onChange(e, data);
            }}
            onKeyDown={isFunction(props.onOK) || isFunction(props.onCancel)
                ? e => {
                    if (isFunction(props.onOK) && e.key === "Enter") props.onOK();
                    else if (isFunction(props.onCancel) && e.key === "Escape") props.onCancel();
                }
                : undefined
            }
            contentBefore={showClear && <CalendarCancelRegular title='Clear' onClick={() => reset()} />}
        />
    );
}