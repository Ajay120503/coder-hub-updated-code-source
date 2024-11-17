import { useEffect, useRef, useState } from 'react';
import { Box, Button, Spinner, Text, useToast, Tooltip, Center, Drawer, DrawerOverlay, DrawerContent, DrawerHeader, DrawerCloseButton, DrawerBody, useDisclosure, DrawerFooter } from '@chakra-ui/react';
import DragMenu from '../DragMenu/DragMenu';
import Theme from '../DragMenu/Theme';
import Members from '../Members/Members';
import { initSocket } from '../../SocketIO';
import { Editor as MonacoEditor } from '@monaco-editor/react';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import FullscreenButton from '../DragMenu/FullscreenButton';
import FilePanel from '../FilePanel/FilePanel';
import { HamburgerIcon } from '@chakra-ui/icons'
import Draggable from 'react-draggable';

function Editor() {
    const socketRef = useRef(null);
    const location = useLocation();
    const { roomId } = useParams();
    const toast = useToast();
    const navigate = useNavigate();
    const [clients, setClients] = useState([]);
    const [language, setLanguage] = useState("javascript");
    const [theme, setTheme] = useState('hc-black');
    const [value, setValue] = useState("");
    const [isLocked, setIsLocked] = useState(false); // To track if the room is locked
    const [admin, setAdmin] = useState(null);
    const { isOpen, onOpen, onClose } = useDisclosure();

    useEffect(() => {
        const handleBeforeUnload = (event) => {
            event.preventDefault();
            event.returnValue = ''; // This is for older browsers
        };

        window.addEventListener('beforeunload', handleBeforeUnload);

        const init = async () => {
            try {
                socketRef.current = await initSocket();
                const handleError = (error) => {
                    console.error(error);
                    toast({
                        description: "No internet connection",
                        status: 'error',
                        duration: 3000,
                        isClosable: false,
                        position: 'top'
                    });
                    navigate("/");
                };

                socketRef.current.on('connect_error', handleError);
                socketRef.current.on('connect_failed', handleError);

                socketRef.current.emit('join', {
                    roomId,
                    username: location.state?.username,
                });

                socketRef.current.on('updateMembers', ({ clients, joinedUser, leftUser, admin, isLocked }) => {
                    if (joinedUser) {
                        const updatedClients = clients.map(client => ({
                            ...client,
                            joinedAt: client.joinedAt || new Date().toISOString() // Add joinedAt timestamp if not already present
                        }));

                        // Add the new user with a timestamp
                        updatedClients.push({
                            ...joinedUser,
                            joinedAt: new Date().toISOString(),
                        });

                        setClients(updatedClients);
                        if (joinedUser && joinedUser.username !== location.state?.username) {
                            toast({
                                description: `${joinedUser.username.toUpperCase()} has joined the room`,
                                status: 'info',
                                duration: 3000,
                                isClosable: false,
                                position: 'top'
                            });
                        }
                    }

                    if (leftUser) {
                        const updatedClients = clients.filter(client => client.socketId !== leftUser.socketId);
                        setClients(updatedClients);
                        toast({
                            description: `${leftUser.username.toUpperCase()} has left the room`,
                            status: 'info',
                            duration: 3000,
                            isClosable: false,
                            position: 'top'
                        });
                    }

                    setClients(clients);
                    setIsLocked(isLocked); // Update room lock status
                    setAdmin(admin || null);
                });

                socketRef.current.on('editorUpdate', ({ value, language }) => {
                    setValue(value);
                    if (language) setLanguage(language);
                });

                socketRef.current.on('languageUpdate', ({ language }) => {
                    setLanguage(language);
                });

                socketRef.current.on('roomLockedStatus', ({ isLocked }) => {
                    setIsLocked(isLocked);
                    if (isLocked) {
                        toast({
                            description: "The room has been locked.",
                            status: 'warning',
                            duration: 3000,
                            isClosable: false,
                            position: 'top'
                        });
                    } else {
                        toast({
                            description: "The room has been unlocked.",
                            status: 'info',
                            duration: 3000,
                            isClosable: false,
                            position: 'top'
                        });
                    }
                });

            } catch (error) {
                console.error(error);
                toast({
                    description: "Try Again",
                    status: 'error',
                    duration: 3000,
                    isClosable: false,
                    position: 'top'
                });
                navigate("/");
            }
        };

        init();

        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current.removeAllListeners();
                window.removeEventListener('beforeunload', handleBeforeUnload);
            }
        };
    }, [location.state?.username, navigate, roomId, toast]);


    if (!location.state) {
        return <Navigate to="/" />;
    }

    const handleValue = (value) => {
        setValue(value);
        socketRef.current?.emit('editorChange', { roomId, value });
    };

    const onSelect = (selectedLanguage) => {
        setLanguage(selectedLanguage);
        socketRef.current?.emit('languageChange', { roomId, language: selectedLanguage });
    };

    const handleSelectTheme = (selectedTheme) => {
        setTheme(selectedTheme);
    };

    const handleCopyId = () => {
        if (roomId) {
            navigator.clipboard.writeText(roomId)
                .then(() => {
                    toast({
                        description: "Room ID copied",
                        status: 'info',
                        duration: 3000,
                        isClosable: false,
                        position: 'top'
                    });
                })
                .catch((error) => {
                    console.error('Failed to copy:', error);
                    toast({
                        description: "Failed to copy Room ID",
                        status: 'error',
                        duration: 3000,
                        isClosable: false,
                        position: 'top'
                    });
                });
        } else {
            toast({
                description: "Room ID is not available",
                status: 'warning',
                duration: 3000,
                isClosable: false,
                position: 'top'
            });
        }
    };

    const handleLeave = (event) => {
        event.preventDefault();
        navigate("/");
    };

    const handleLockRoom = () => {
        socketRef.current?.emit('lockRoom', { roomId });
    };

    const handleUnlockRoom = () => {
        socketRef.current?.emit('unlockRoom', { roomId });
    };
    return (
        <Box display='flex' w='100%' overflow='auto' flexDirection='row' backgroundColor='#2E2E2E'>
            <Box>
                <Draggable>
                    <Box
                        position="absolute"
                        zIndex={100}
                        top="20%"
                        right="0px"
                        cursor="move"
                        display="flex"
                        flexDirection='column'
                    >
                        {/* Hamburger Icon Button */}
                        <Button
                            colorScheme="blue"
                            size="sm"
                            style={{ borderRadius: "0px" }}
                            onClick={onOpen}
                        >
                            <HamburgerIcon />
                        </Button>

                        {/* Leave Button */}
                        <Button
                            size="sm"
                            colorScheme="red"
                            onClick={handleLeave}
                            style={{ borderRadius: "0px" }}
                        >
                            <i className="fa-solid fa-right-from-bracket"></i>
                        </Button>
                    </Box>
                </Draggable>

                <Drawer placement="left" onClose={onClose} isOpen={isOpen}>
                    <DrawerOverlay />
                    <DrawerContent>
                        <DrawerHeader bg="gray.900">
                            <DrawerCloseButton color="#fff" _hover={{ bg: "gray.700" }} />
                            <Text
                                fontSize="25px"
                                color="#fff"
                                fontWeight="bold"
                                display="flex"
                                alignItems="center"
                            >
                                <Box as="i" className="fa-solid fa-laptop" color="#cf6679" marginRight="5px" />
                                CODER
                                <Box as="span" color="#bb86fc" paddingLeft="5px" letterSpacing="8px">
                                    HUB
                                </Box>
                            </Text>
                        </DrawerHeader>
                        <DrawerBody bg="gray.800">
                            <Text color='#fff' fontFamily='monospace' fontSize='25px' fontWeight='900' mb={2}>Members</Text>
                            <Box height='70vh' overflow='auto'>
                                <Box height='70vh' overflow='auto'>
                                    <Members
                                        clients={clients}
                                        admin={admin}
                                    />
                                </Box>
                            </Box>
                        </DrawerBody>
                        <DrawerFooter gap={1} bg="gray.900" display="flex" justifyContent="center">
                            <Tooltip hasArrow arrowSize={10} placement='top-start' label='Copy the Room Id' fontSize='xs' >
                                <Button size='sm' colorScheme='blue' onClick={handleCopyId} style={{ borderRadius: "0px" }}><i className="fa-solid fa-copy"></i></Button>
                            </Tooltip>
                            <Tooltip hasArrow arrowSize={10} placement='top-start' label='Only Admin Can Lock the Room' fontSize='xs' >
                                <Button size='sm' colorScheme={isLocked ? 'red' : 'green'} onClick={isLocked ? handleUnlockRoom : handleLockRoom} style={{ borderRadius: "0px" }}>
                                    {isLocked ? <i className="fa-solid fa-lock"></i> : <i className="fa-solid fa-unlock"></i>}
                                </Button>
                            </Tooltip>
                            <Theme theme={theme} onSelectTheme={handleSelectTheme} />
                            <FullscreenButton />
                            <DragMenu language={language} onSelect={onSelect} />
                            <FilePanel
                                editorContent={value}
                                onFileChange={(content) => setValue(content)}
                            />
                        </DrawerFooter>
                    </DrawerContent>
                </Drawer>
            </Box>
            <Box w="100vw" height='100vh'>
                <Box h='0vh'>
                </Box>
                <Box h='100vh'>
                    <MonacoEditor
                        height="100%"
                        language={language}
                        theme={theme}
                        options={{
                            automaticLayout: true,
                            minimap: { enabled: false },
                            fontSize: 18,
                            wordWrap: "off",
                            scrollBeyondLastLine: false,
                            lineNumbers: "on",
                            autoIndent: "full",
                            matchBrackets: "always",
                            folding: true,
                            smoothScrolling: true,
                            renderWhitespace: "all",
                            scrollbar: {
                                vertical: "auto",
                                horizontal: "auto",
                            },
                            tabSize: 4,

                            // Autocompletion-specific options
                            suggestOnTriggerCharacters: true,  // Enable autocomplete on typing characters like `.`
                            quickSuggestions: { other: true, comments: true, strings: true },  // Enable autocomplete in various contexts
                            acceptSuggestionOnEnter: "on",  // Accept suggestions by pressing 'Enter'
                            snippetSuggestions: "inline",  // Show snippet suggestions inline with other suggestions
                        }}
                        loading={
                            <Center height="100%">
                                <Spinner
                                    thickness='5px'
                                    speed='0.65s'
                                    emptyColor='gray.200'
                                    color='blue.500'
                                    size='xl'
                                />
                            </Center>
                        }
                        value={value}
                        onChange={handleValue}
                    />
                </Box>
            </Box>
        </Box>
    );
}

export default Editor;
