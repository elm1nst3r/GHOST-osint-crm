export function withPane(props, context) {
    const pane = props.pane ?? context.pane;
    return pane ? {
        ...props,
        pane
    } : props;
}
