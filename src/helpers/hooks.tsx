import { Link, Toast, ToastBody, Toaster, ToastFooter, ToastIntent, ToastTitle, useId, useToastController } from "@fluentui/react-components";
import { IDictionary, isDebug, isFunction, isNotEmptyArray, isNullOrEmptyString, jsonClone, jsonStringify, LoggerLevel, objectsEqual, wrapFunction } from "@kwiz/common";
import { MutableRefObject, SetStateAction, useCallback, useEffect, useRef, useState } from "react";
import { GetLogger } from "../_modules/config";
import { IPrompterProps, Prompter } from "../controls/prompt";
import { KnownClassNames } from "../styles/styles";

const logger = GetLogger("helpers/hooks");
/** Empty array ensures that effect is only run on mount */
export const useEffectOnlyOnMount = [];

/** set state on steroids. provide promise callback after render, onChange transformer and automatic skip-set when value not changed */
export function useStateEX<ValueType>(initialValue: ValueType, options?: {
    onChange?: (newValue: SetStateAction<ValueType>) => SetStateAction<ValueType>;
    //will not set state if value did not change
    skipUpdateIfSame?: boolean;
    //optional, provide a name for better logging
    name?: string;
}):
    [ValueType, (newValue: SetStateAction<ValueType>) => Promise<ValueType>, MutableRefObject<ValueType>] {
    options = options || {};
    const name = options.name || '';

    let logger = GetLogger(`useStateWithTrack${isNullOrEmptyString(name) ? '' : ` ${name}`}`);
    logger.setLevel(LoggerLevel.WARN);

    const [value, setValueInState] = useState(initialValue);
    const currentValue = useRef(value);

    /** make this a collection in case several callers are awaiting the same propr update */
    const resolveState = useRef<((v: ValueType) => void)[]>([]);
    const isMounted = useRef(false);

    useEffect(() => {
        isMounted.current = true;

        return () => {
            isMounted.current = false;
        };
    }, useEffectOnlyOnMount);

    function resolvePromises() {
        if (isNotEmptyArray(resolveState.current)) {
            let resolvers = resolveState.current.slice();
            resolveState.current = [];//clear
            resolvers.map(r => r(currentValue.current));
        }
    };
    useEffect(() => {
        resolvePromises();
        if (isNotEmptyArray(resolveState.current)) {
            logger.log(`resolved after render`);
            let resolvers = resolveState.current.slice();
            resolveState.current = [];//clear
            resolvers.map(r => r(value));
        }
    }, [value, resolveState.current]);

    let setValueWithCheck = !options.skipUpdateIfSame ? setValueInState : (newValue: ValueType) => {
        logger.groupSync('conditional value change', log => {
            if (logger.getLevel() === LoggerLevel.VERBOSE) {
                log('old: ' + jsonStringify(currentValue.current));
                log('new: ' + jsonStringify(newValue));
            }
            if (!objectsEqual(newValue as object, currentValue.current as object)) {
                log(`value changed`);
                setValueInState(newValue);
            }
            else {
                log(`value unchanged`);
                resolvePromises();
            }
        });
    }


    let setValueWithEvents = wrapFunction(setValueWithCheck, {
        before: newValue => isFunction(options.onChange) ? options.onChange(newValue) : newValue,
        after: newValue => currentValue.current = newValue as ValueType
    });

    const setValue = useCallback((newState: ValueType) => new Promise<ValueType>(resolve => {
        if (!isMounted.current) {
            //unmounted may never resolve
            logger.log(`resolved without wait`);
            resolve(newState);
        }
        else {
            resolveState.current.push(resolve);
            setValueWithEvents(newState);
        }
    }), []);

    return [value, setValue, currentValue];
}
export function useTrackFocus(props: { onFocus: () => void, onLoseFocus: () => void, ref?: MutableRefObject<HTMLElement> }) {
    const wrapperDiv = props.ref || useRef<HTMLDivElement>(null);
    useEffect(() => {
        function focusIn(e: FocusEvent) {
            let elm = e.target as HTMLElement;//document.activeElement;
            if (wrapperDiv.current) {
                while (elm && elm !== wrapperDiv.current) {
                    elm = elm.parentElement;
                }
            } else elm = null;
            if (wrapperDiv.current && elm === wrapperDiv.current) props.onFocus();
            else props.onLoseFocus();
        }

        if (wrapperDiv.current) {
            if (wrapperDiv.current) wrapperDiv.current.tabIndex = 1;
            window.addEventListener("focusin", focusIn);
            // Remove event listener on cleanup
            return () => window.removeEventListener("focusin", focusIn);
        }
    }, [wrapperDiv.current]);
    return wrapperDiv;
}
export function useWindowSize() {
    // Initialize state with undefined width/height so server and client renders match
    // Learn more here: https://joshwcomeau.com/react/the-perils-of-rehydration/
    const [windowSize, setWindowSize] = useState<{
        width: number,
        height: number
    }>({
        width: undefined,
        height: undefined
    });
    useEffect(() => {
        // Handler to call on window resize
        function handleResize() {

            // Set window width/height to state
            setWindowSize({
                width: window.innerWidth,
                height: window.innerHeight
            });
        }
        // Add event listener
        window.addEventListener("resize", handleResize);
        // Call handler right away so state gets updated with initial window size
        handleResize();
        // Remove event listener on cleanup
        return () => window.removeEventListener("resize", handleResize);
    }, useEffectOnlyOnMount);
    return windowSize;
}
export function useIsInPrint() {
    // Initialize state with false
    const [printMode, setPrintMode] = useState<boolean>(false);
    useEffect(() => {
        function forcePrint(e: KeyboardEvent) {
            if (e.ctrlKey && e.shiftKey && e.altKey) {
                if (e.key.toLocaleLowerCase() === "q") {
                    document.body.classList.remove(KnownClassNames.print);
                    handlePrint(e, false);
                }
                else {
                    console.warn('forced print mode - to exit refresh to ctrl+shift+alt+q');
                    document.body.classList.add(KnownClassNames.print);
                    handlePrint(e, true);
                }
            }
        }
        // Handler to call on printing
        function handlePrint(e?: Event, force?: boolean) {
            if (force === true) setPrintMode(true);
            else if (window.matchMedia) {
                var mediaQueryList = window.matchMedia('print');
                if (mediaQueryList.matches) {
                    setPrintMode(true);
                } else {
                    setPrintMode(false);
                }
            }
        }
        // Add event listener
        window.addEventListener("print", handlePrint);
        if (isDebug())
            window.addEventListener("keydown", forcePrint);
        // Call handler right away so state gets updated with initial printing state
        handlePrint();
        // Remove event listener on cleanup
        return () => {
            window.removeEventListener("print", handlePrint);
            if (isDebug())
                window.removeEventListener("keydown", forcePrint);
        };
    }, useEffectOnlyOnMount);
    return printMode;
}
/** set block message if you want to block nav.
 * - call setMessage to  add a blocker message
 * - call onNav when you have internal navigation (open / close popups)
 * - render the navPrompt control to your page
 * FYI for page unload, most modern browsers won't show your message but a generic one instead. */
export function useBlockNav() {
    const [, setBlockNavMessages, blockNavMessagesRef] = useStateEX<IDictionary<string>>({});
    const [prompt, setPrompt] = useStateEX<IPrompterProps>(null);

    const getMessagesArr = useCallback(() => {
        return Object.keys(blockNavMessagesRef.current).map(id => blockNavMessagesRef.current[id]);
    }, useEffectOnlyOnMount);

    const getMessages = useCallback(() => {
        return getMessagesArr().join();
    }, useEffectOnlyOnMount);

    const onNav = useCallback((nav: () => void) => {
        let messages = getMessagesArr();
        if (isNotEmptyArray(messages)) {
            //need to release react to re-render the prompt
            window.setTimeout(() => {
                //prompt, if ok - clear messages and nav.
                setPrompt({
                    okButtonText: "Leave",
                    cancelButtonText: "Cancel",
                    title: "Leave page?",
                    children: messages.length > 1
                        ? <ul>
                            {messages.map((m, i) => <li key={`m${i}`}>{m}</li>)}
                        </ul>
                        : <p>{messages[0]}</p>,
                    onCancel: () => setPrompt(null),
                    onOK: () => {
                        setPrompt(null);
                        setBlockNavMessages({});//clear messages
                        nav();
                    }
                });
            }, 1);
        }
        else nav();
    }, useEffectOnlyOnMount);


    useEffect(() => {
        function handleBeforeUnload(e: BeforeUnloadEvent) {
            //todo: use blockMessageRef.current so that we don't have to re-register every time message changes.
            //otherwise we would have to add blockMessage as a dependency for this useEffect
            const message = getMessages();
            if (!isNullOrEmptyString(message)) {
                e.preventDefault();
                e.returnValue = message;
            }
        }
        // Add event listener
        window.addEventListener("beforeunload", handleBeforeUnload);
        // Remove event listener on cleanup
        return () => window.removeEventListener("beforeunload", handleBeforeUnload);
    }, useEffectOnlyOnMount);
    return {
        setMessage: (id: string, message?: string) => {
            let current = jsonClone(blockNavMessagesRef.current);
            if (isNullOrEmptyString(message))
                delete current[id];
            else current[id] = message;
            if (!objectsEqual(current, blockNavMessagesRef.current))
                setBlockNavMessages(current);
        },
        // clearMessages: () => {
        //     setBlockNavMessages({});
        // },
        // getMessages,
        // getMessagesArr,
        onNav,
        navPrompt: prompt ? <Prompter {...prompt} /> : undefined
    };
}

export function useToast() {
    const toasterId = useId("toaster");
    const { dispatchToast } = useToastController(toasterId);
    return {
        control: <Toaster toasterId={toasterId} />,
        dispatch: (info: {
            title?: string;
            body?: string;
            subtitle?: string;
            titleAction?: { text: string, onClick: () => void },
            footerActions?: { text: string, onClick: () => void }[],
            intent?: ToastIntent
        }) => {
            dispatchToast(<Toast>
                {info.title && <ToastTitle action={info.titleAction ? <Link onClick={info.titleAction.onClick}>{info.titleAction.text}</Link> : undefined}>{info.title}</ToastTitle>}
                {info.body && <ToastBody subtitle={info.subtitle}>{info.body}</ToastBody>}
                {isNotEmptyArray(info.footerActions) &&
                    <ToastFooter>
                        {info.footerActions.map((a, i) => <Link key={`l${i}`} onClick={a.onClick}>{a.text}</Link>)}
                    </ToastFooter>
                }
            </Toast>, { intent: info.intent || "info" });
        }
    }
}