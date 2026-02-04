import {ScaleBand, ScaleLinear} from 'd3';
import React from 'react';

function identity(x: any): any {
    return x;
}
function translateX(x: number): string {
    return `translate(${x + 0.5},0)`;
}
function translateY(y: number): string {
    return `translate(0,${y + 0.5})`;
}
function number(scale: ScaleLinear<number, number> | ScaleBand<string>): (d: any) => number {
    return (d: any): number => {
        const val = scale(d);
        return typeof val === 'number' ? +val : 0;
    };
}
function center(scale: ScaleBand<string>): (d: any) => number {
    let offset = Math.max(0, scale.bandwidth() - 1) / 2; // Adjust for 0.5px offset.
    const roundFn = (scale as any).round;
    if (roundFn && typeof roundFn === 'function' && roundFn()) offset = Math.round(offset);
    return (d: any): number => {
        const val = scale(d);
        return (typeof val === 'number' ? +val : 0) + offset;
    };
}

type AxisProps = {
    children?: any;
    scale: ScaleBand<string> | ScaleLinear<number, number>;
    orientation: string;
    ticks?: number | (number | string)[];
    tickValues?: (number | string)[];
    tickFormat?: (n: number | string | {
        valueOf(): number;
    }) => string;
    tickSize?: number;
    tickSizeInner?: number;
    tickSizeOuter?: number;
    tickPadding?: number;
    transform?: string;
}

export const Axis = (props: AxisProps) => {

    const scale = props.scale;
    const orient = props.orientation || 'left';
    const tickArguments: any[] = props.ticks ? [].concat(props.ticks as any) : [];
    const tickValues = props.tickValues || undefined;
    const tickFormat = props.tickFormat || undefined;
    const tickSizeInner = props.tickSize !== undefined ? props.tickSize : (props.tickSizeInner || 6);
    const tickSizeOuter = props.tickSize !== undefined ? props.tickSize : (props.tickSizeOuter || 6);
    const tickPadding = props.tickPadding || 3;

    const k = orient === 'top' || orient === 'left' ? -1 : 1;
    const x = orient === 'left' || orient === 'right' ? 'x' : 'y';
    const transform = orient === 'top' || orient === 'bottom' ? translateX : translateY;

    const scaleLinear = scale as ScaleLinear<number, number>;
    const scaleBand = scale as ScaleBand<string>;
    const hasTicksFn = typeof scaleLinear.ticks === 'function';
    const hasTickFormatFn = typeof scaleLinear.tickFormat === 'function';
    const values = tickValues == null ?
        (hasTicksFn ? scaleLinear.ticks(...tickArguments) : (scaleBand.domain ? scaleBand.domain() : []))
        : tickValues;
    const format = tickFormat == null ?
        (hasTickFormatFn ? scaleLinear.tickFormat(...tickArguments) : identity)
        : tickFormat;
    const spacing = Math.max(tickSizeInner, 0) + tickPadding;
    const range = scale.range();
    const range0 = +(range[0] || 0) + 0.5;
    const range1 = +(range[range.length - 1] || 0) + 0.5;
    const hasBandwidth = typeof scaleBand.bandwidth === 'function';
    const position = (hasBandwidth ? center : number)(scale.copy() as any);

    return (
        <g
            fill='none'
            fontSize={10}
            fontFamily='sans-serif'
            textAnchor={orient === 'right' ? 'start' : orient === 'left' ? 'end' : 'middle'}
            transform={props.transform}>
            <path
                className='domain'
                stroke='#000'
                d={orient === 'left' || orient === 'right' ?
                    `M${k * tickSizeOuter},${range0}H0.5V${range1}H${k * tickSizeOuter}` :
                    `M${range0},${k * tickSizeOuter}V0.5H${range1}V${k * tickSizeOuter}`} />
            {values.map((d: any, i: number) =>
                <g
                    key={i}
                    className='tick'
                    transform={transform(position(d))}>
                    <line
                        stroke='#000'
                        {...{[`${x}2`]: k * tickSizeInner}}/>
                    <text
                        fill='#000'
                        dy={orient === 'top' ? '0em' : orient === 'bottom' ? '0.71em' : '0.32em'}
                        {...{[x]: k * spacing}}>{format(d)}</text>
                </g>
            )}
            {props.children}
        </g>
    );
};
