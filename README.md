<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=6,11,20&height=200&section=header&text=Hive&fontSize=80&fontColor=fff&animation=fadeIn&fontAlignY=35&desc=A%20Community%20Skill%20Exchange%20Platform&descAlignY=55&descSize=18" alt="Hive banner"/>

<img src="https://readme-typing-svg.demolab.com/?lines=Trade+skills%2C+not+money.;A+community+where+knowledge+is+the+currency.;Full-stack+platform+%E2%80%94+React+%2B+Node.js+%2B+MongoDB;Learn+something+new.+Teach+something+you+know.&font=Fira%20Code&center=true&width=600&height=45&color=F7B801&vCenter=true&size=20" alt="Typing SVG"/>

<br/>

<p>
  <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React"/>
  <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js"/>
  <img src="https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express"/>
  <img src="https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white" alt="MongoDB"/>
  <img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" alt="JavaScript"/>
</p>

<p>
  <img src="https://img.shields.io/github/last-commit/Special258/Hive?style=for-the-badge&color=success" alt="Last Commit"/>
  <img src="https://img.shields.io/github/languages/top/Special258/Hive?style=for-the-badge&color=yellow" alt="Top Language"/>
  <img src="https://img.shields.io/github/repo-size/Special258/Hive?style=for-the-badge&color=informational" alt="Repo Size"/>
  <img src="https://img.shields.io/github/license/Special258/Hive?style=for-the-badge&color=blue" alt="License"/>
</p>

<p>
  <img src="https://img.shields.io/github/issues/Special258/Hive?style=for-the-badge&color=red" alt="Issues"/>
  <img src="https://img.shields.io/github/issues-pr/Special258/Hive?style=for-the-badge&color=purple" alt="Pull Requests"/>
  <img src="https://img.shields.io/github/stars/Special258/Hive?style=for-the-badge&color=gold" alt="Stars"/>
  <img src="https://img.shields.io/badge/status-in%20development-orange?style=for-the-badge" alt="Status"/>
</p>

</div>

<img src="https://capsule-render.vercel.app/api?type=rect&color=gradient&customColorList=6,11,20&height=3" width="100%"/>

## 📖 About

**Hive** is a full-stack community platform where people trade skills instead of money. Users list what they can teach and what they want to learn, get matched with others in the community, and connect to exchange knowledge — no cash changes hands, just expertise.

<img src="https://capsule-render.vercel.app/api?type=rect&color=gradient&customColorList=6,11,20&height=3" width="100%"/>

## ✨ Features

- 🔐 **User authentication** — secure signup/login flow
- 🧑‍🤝‍🦱 **Skill matching** — connect users who can teach with users who want to learn
- 💬 **Community-driven** — profiles, listings, and connections built around real people exchanging real skills
- 💾 **MongoDB-backed persistence** — flexible, document-based data modeling for users and skills
- 🔌 **RESTful API** — clean, predictable endpoints connecting the React frontend to the backend
- ⚙️ **Environment-based config** — easy setup across dev/staging/production via `.env`


<img src="https://capsule-render.vercel.app/api?type=rect&color=gradient&customColorList=6,11,20&height=3" width="100%"/>

## 🛠️ Tech Stack

**Frontend**

<p>
  <img src="https://img.shields.io/badge/React-20232A?style=flat-square&logo=react&logoColor=61DAFB"/>
  <img src="https://img.shields.io/badge/React_Router-CA4245?style=flat-square&logo=react-router&logoColor=white"/>
  <img src="https://img.shields.io/badge/Axios-5A29E4?style=flat-square&logo=axios&logoColor=white"/>
  <img src="https://img.shields.io/badge/CSS3-1572B6?style=flat-square&logo=css3&logoColor=white"/>
</p>

**Backend**

<p>
  <img src="https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=node.js&logoColor=white"/>
  <img src="https://img.shields.io/badge/Express.js-000000?style=flat-square&logo=express&logoColor=white"/>
  <img src="https://img.shields.io/badge/Mongoose-880000?style=flat-square&logo=mongoose&logoColor=white"/>
  <img src="https://img.shields.io/badge/JWT-000000?style=flat-square&logo=jsonwebtokens&logoColor=white"/>
  <img src="https://img.shields.io/badge/bcrypt-338833?style=flat-square"/>
  <img src="https://img.shields.io/badge/dotenv-ECD53F?style=flat-square"/>
  <img src="https://img.shields.io/badge/CORS-FF6C37?style=flat-square"/>
</p>

**Database & Tools**

<p>
  <img src="https://img.shields.io/badge/MongoDB-47A248?style=flat-square&logo=mongodb&logoColor=white"/>
  <img src="https://img.shields.io/badge/Postman-FF6C37?style=flat-square&logo=postman&logoColor=white"/>
  <img src="https://img.shields.io/badge/Nodemon-76D04B?style=flat-square&logo=nodemon&logoColor=white"/>
  <img src="https://img.shields.io/badge/npm-CB3837?style=flat-square&logo=npm&logoColor=white"/>
  <img src="https://img.shields.io/badge/Git-F05032?style=flat-square&logo=git&logoColor=white"/>
</p>

<img src="https://capsule-render.vercel.app/api?type=rect&color=gradient&customColorList=6,11,20&height=3" width="100%"/>

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+ recommended)
- [MongoDB](https://www.mongodb.com/) — running locally or a free [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) cluster

## 🔌 API Overview

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Register a new user |
| `POST` | `/api/auth/login` | Log in an existing user |
| `GET` | `/api/skills` | Fetch available skills |
| `POST` | `/api/skills` | Add a new skill listing |

> ✏️ Replace this with your real routes once `routes/`/`controllers/` are built out — an accurate endpoint list is one of the highest-impact additions you can make.

<img src="https://capsule-render.vercel.app/api?type=rect&color=gradient&customColorList=6,11,20&height=3" width="100%"/>

<img src="https://capsule-render.vercel.app/api?type=rect&color=gradient&customColorList=6,11,20&height=3" width="100%"/>

## 👥 Team

<a href="https://github.com/Special258/Hive/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=Special258/Hive" alt="Team"/>
</a>

<img src="https://capsule-render.vercel.app/api?type=rect&color=gradient&customColorList=6,11,20&height=3" width="100%"/>

## 📈 Repo Activity

<div align="center">

<img src="https://github-readme-activity-graph.vercel.app/graph?username=Special258&repo=Hive&theme=react-dark&hide_border=true" alt="Activity Graph" width="100%"/>

</div>

<img src="https://capsule-render.vercel.app/api?type=rect&color=gradient&customColorList=6,11,20&height=3" width="100%"/>

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](./LICENSE) file for details.

<div align="center">

### 👤 Maintainer

**Jal Patel** ([@Special258](https://github.com/Special258))

<a href="https://www.linkedin.com/in/jalpatel-dataai"><img src="https://img.shields.io/badge/LinkedIn-0077B5?style=for-the-badge&logo=linkedin&logoColor=white"/></a>
<a href="mailto:jalpatel798@gmail.com"><img src="https://img.shields.io/badge/Email-D14836?style=for-the-badge&logo=gmail&logoColor=white"/></a>

⭐ **If Hive interests you, consider giving this repo a star!** ⭐

<img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=6,11,20&height=100&section=footer" width="100%"/>

</div>
