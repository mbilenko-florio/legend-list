export const correctByModule = (index: number | null, numColumns: number) => {
    if (index == null) {
        return index;
    }
    const module = index % numColumns;
    if (module > 0) {
        return index - module;
    }
    return index;
};

export const correctByModuleUp = (index: number | null, numColumns: number) => {
    if (index == null) {
        return index;
    }
    const module = index % numColumns;
    if (module > 0) {
        return index + (numColumns-module);
    }
    return index;
};

