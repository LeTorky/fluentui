import { makeStyles } from '@fluentui/react-components';
import { isNotEmptyArray } from '@kwiz/common';
import React from 'react';
import { KnownClassNames, mixins } from '../styles/styles';
import { ISectionProps, Section } from './section';

const useStyles = makeStyles({
    horizontal: {
        ...mixins.flex,
        flexDirection: 'row'
    },
    wrap: mixins.wrap,
    nogap: mixins.nogap,
    centered: {
        alignItems: "center"
    }
})

interface IProps extends ISectionProps {
    wrap?: boolean;
    nogap?: boolean;
    centered?: boolean;
}
export const Horizontal = React.forwardRef<HTMLDivElement, React.PropsWithChildren<IProps>>((props, ref) => {
    const cssNames = useStyles();
    let css: string[] = [KnownClassNames.horizontal];

    css.push(cssNames.horizontal);
    if (props.wrap)
        css.push(cssNames.wrap);
    if (props.nogap)
        css.push(cssNames.nogap);
    if (props.centered)
        css.push(cssNames.centered);

    if (isNotEmptyArray(props.css)) css.push(...props.css);

    return (
        <Section {...props} css={css} />
    );
});