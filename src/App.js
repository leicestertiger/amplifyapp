import React, { useState, useEffect, Component } from 'react';
import './App.css';
import Amplify, { API, Storage, Auth } from 'aws-amplify';
import { withAuthenticator, AmplifySignOut } from '@aws-amplify/ui-react';
import { listNotes } from './graphql/queries';
import { createNote as createNoteMutation, deleteNote as deleteNoteMutation } from './graphql/mutations';
import awsconfig from './aws-exports';

Amplify.configure(awsconfig);

const initialFormState = { name: '', description: '' }

function App() {
  const [notes, setNotes] = useState([]);
  const [formData, setFormData] = useState(initialFormState);

async function addToGroup() { 
  let apiName = 'AdminQueries';
  let path = '/addUserToGroup';
  let myInit = {
      body: {
        "username" : "elf",
        "groupname": "clubadmin"
      }, 
      headers: {
        'Content-Type' : 'application/json',
        Authorization: `${(await Auth.currentSession()).getAccessToken().getJwtToken()}`
      } 
  }
  return await API.post(apiName, path, myInit);
}


let nextToken;

async function listEditors(limit){
  let apiName = 'AdminQueries';
  let path = '/listUsersInGroup';
  let myInit = { 
      queryStringParameters: {
        "groupname": "clubadmin",
        "limit": limit,
        "token": nextToken
      },
      headers: {
        'Content-Type' : 'application/json',
        Authorization: `${(await Auth.currentSession()).getAccessToken().getJwtToken()}`
      }
  }
  const { NextToken, ...rest } =  await API.get(apiName, path, myInit);
  nextToken = NextToken;
  return rest;
}

  useEffect(() => {
    fetchNotes();
  }, []);

  async function fetchNotes() {
	  const apiData = await API.graphql({ query: listNotes });
	  const notesFromAPI = apiData.data.listNotes.items;
	  await Promise.all(notesFromAPI.map(async note => {
		if (note.image) {
		  const image = await Storage.get(note.image);
		  note.image = image;
		}
		return note;
	  }))
	  setNotes(apiData.data.listNotes.items);
  }

  async function createNote() {
	  if (!formData.name || !formData.description) return;
	  await API.graphql({ query: createNoteMutation, variables: { input: formData } });
	  if (formData.image) {
		const image = await Storage.get(formData.image);
		formData.image = image;
	  }
	  setNotes([ ...notes, formData ]);
	  setFormData(initialFormState);
	}
  
  async function onChange(e) {
	  if (!e.target.files[0]) return
	  const file = e.target.files[0];
	  setFormData({ ...formData, image: file.name });
	  await Storage.put(file.name, file);
	  fetchNotes();
  }

  async function deleteNote({ id }) {
    const newNotesArray = notes.filter(note => note.id !== id);
    setNotes(newNotesArray);
    await API.graphql({ query: deleteNoteMutation, variables: { input: { id } }});
  }

  return (
    <div className="App">
      <h1>My Notes App</h1>
      <input
        onChange={e => setFormData({ ...formData, 'name': e.target.value})}
        placeholder="Note name"
        value={formData.name}
      />
      <input
        onChange={e => setFormData({ ...formData, 'description': e.target.value})}
        placeholder="Note description"
        value={formData.description}
      />
	  <input
		  type="file"
		  onChange={onChange}
		/>
      <button onClick={createNote}>Create Note</button>
      <div style={{marginBottom: 30}}>
        {
		  notes.map(note => (
			<div key={note.id || note.name}>
			  <h2>{note.name}</h2>
			  <p>{note.description}</p>
			  <button onClick={() => deleteNote(note)}>Delete note</button>
			  {
				note.image && <img src={note.image} style={{width: 400}} />
			  }
			</div>
		  ))
		}
      </div>
	  <button onClick={addToGroup}>Add to Group</button>
      <button onClick={() => listEditors(10)}>List Editors</button>
      <AmplifySignOut />
    </div>
  );
}

export default withAuthenticator(App);