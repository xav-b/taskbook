package main

import (
	"encoding/json"
	"fmt"
	"net"
)

type NetCommand struct {
	Command   string   `json:"command"`
	Data      []string `json:"itemIds"`
	Arguments []string `json:"arguments"`
}

func main() {
	fmt.Println("connecting to taskbook server")
	conn, err := net.Dial("tcp", "localhost:2222")
	if err != nil {
		panic(err)
	}
	defer conn.Close()

	// build message
	msg := NetCommand{
		Command: "ping",
	}

	payload, err := json.Marshal(msg)
	if err != nil {
		panic(err)
	}

	status, err := conn.Write(payload)
	if err != nil {
		fmt.Println("Error:", err)
		panic(err)
	}
	fmt.Printf("status: %v\n", status)

	reply := make([]byte, 1024)

	_, err = conn.Read(reply)
	if err != nil {
		panic(err)
	}

	println("reply from server=", string(reply))
}
