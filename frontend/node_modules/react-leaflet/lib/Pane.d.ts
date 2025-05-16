import React, { type CSSProperties, type ReactNode } from 'react';
export interface PaneProps {
    children?: ReactNode;
    className?: string;
    name: string;
    pane?: string;
    style?: CSSProperties;
}
export declare const Pane: React.ForwardRefExoticComponent<PaneProps & React.RefAttributes<HTMLElement>>;
