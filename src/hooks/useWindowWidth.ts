"use client"

import { useState, useEffect, useLayoutEffect } from 'react'

const useWindowWidth = () => {
    const [size, setSize] = useState(0);

    useLayoutEffect(() => {
        const updateWindowSize = () => {
            setSize(window.innerWidth);
        }
        window.addEventListener('resize', updateWindowSize);
        updateWindowSize();
     
        return () => window.removeEventListener('resize', updateWindowSize);
    }, []);
    return size;
}

export default useWindowWidth