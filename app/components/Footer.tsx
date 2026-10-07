"use client";

import React from "react";
import styles from "./Footer.module.css";

interface FooterProps {
  darkMode?: boolean;
  className?: string;
}

export default function Footer({ darkMode = false, className = "" }: FooterProps) {
  const currentYear = new Date().getFullYear();

  return (
    <footer
      className={`${styles.footer} ${darkMode ? styles.darkFooter : ""} ${className}`}
    >
      <div className={styles.footerLeft}>
        <div className={styles.footerAuthor}>
          <span>👨‍💻 Created by</span>
          <span className={styles.footerAuthorHighlight}>Raja vishagan</span>
        </div>
        <span className={styles.footerRole}>
          Full Stack Developer • Task Management System
        </span>
      </div>

      <div className={styles.footerLinks}>
        <a
          href="https://github.com"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.footerLink}
          title="GitHub Profile (Update link here)"
        >
          🐙 GitHub
        </a>
        <a
          href="https://linkedin.com"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.footerLink}
          title="LinkedIn Profile (Update link here)"
        >
          💼 LinkedIn
        </a>
        <a
          href="mailto:contact@example.com"
          className={styles.footerLink}
          title="Send Email (Update address here)"
        >
          ✉️ Contact
        </a>
      </div>

      <div className={styles.footerCopyright}>
        © {currentYear} Task Management System • Designed & Developed by Raja vishagan
      </div>
    </footer>
  );
}

