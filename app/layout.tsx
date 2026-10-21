import type {Metadata} from 'next';import type {ReactNode} from 'react';import './globals.css';
export const metadata:Metadata={title:'TOMOCA Reads · A wider world, with your coffee',description:'Ethiopia, Africa and the world. Your coffee-break reading desk at TOMOCA.',manifest:'/manifest.webmanifest',icons:{icon:'/favicon.svg'}};
export default function Layout({children}:{children:ReactNode}){return <html lang="en"><body>{children}</body></html>}
