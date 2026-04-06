import { useEffect, useState } from 'react'
import botImage from './assets/bot.png'
import logoImage from './assets/logo.png'
import './App.css'

function App() {
  const [isLoading, setIsLoading] = useState(true)
  const [currentStep, setCurrentStep] = useState(1)
  const [isMobile, setIsMobile] = useState(false)
  const [mobileStarted, setMobileStarted] = useState(false)

  useEffect(() => {
    const finishLoading = () => {
      window.setTimeout(() => setIsLoading(false), 2200)
    }

    if (document.readyState === 'complete') {
      finishLoading()
      return undefined
    }

    window.addEventListener('load', finishLoading, { once: true })

    return () => {
      window.removeEventListener('load', finishLoading)
    }
  }, [])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 980px)')
    const syncMobileState = (event) => {
      const nextIsMobile = event.matches ?? event.currentTarget.matches
      setIsMobile(nextIsMobile)
      if (!nextIsMobile) {
        setMobileStarted(false)
      }
    }

    syncMobileState(mediaQuery)
    mediaQuery.addEventListener('change', syncMobileState)
    return () => mediaQuery.removeEventListener('change', syncMobileState)
  }, [])

  if (isLoading) {
    return (
      <div className="preloader" role="status" aria-live="polite">
        <img className="preloader-logo" src={logoImage} alt="Loading NextGenForge" />
      </div>
    )
  }

  return (
    <main className="page">
      <section className={`registration-card ${isMobile && mobileStarted ? 'mobile-form-active' : ''}`}>
        {(!isMobile || !mobileStarted) && (
          <aside className="left-panel">
            <img className="brand-logo" src={logoImage} alt="NextGenForge 1.0" />

            <div className="bot-wrap">
              <img className="bot-image" src={botImage} alt="NextGenForge mascot bot" />
            </div>

            <div className="left-copy">
              <h1>Students registration form</h1>
              <p>
                NextGenForge Fellowship is a 3-month hands-on program that teaches
                you how to build AI agents and turn those skills into real income
                opportunities.
              </p>
              <p>
                Whether you are a beginner or looking to pivot into AI, you will
                learn practical skills, work on real projects, and gain a clear path
                to freelancing, jobs, or building your own solutions.
              </p>
            </div>

            {isMobile && (
              <button className="mobile-start-btn" type="button" onClick={() => setMobileStarted(true)}>
                Get Started
              </button>
            )}
          </aside>
        )}

        {(!isMobile || mobileStarted) && (
          <section className="right-panel">
          {isMobile && <img className="mobile-form-logo" src={logoImage} alt="NextGenForge 1.0" />}
          {currentStep === 1 ? (
            <>
              <h2>
                Fill this form to secure your spot
                <br />
                and become a disruptive AI Builder
              </h2>

              <form className="form" onSubmit={(event) => event.preventDefault()}>
                <label htmlFor="email">Email</label>
                <input id="email" type="email" placeholder="Enter email" />

                <label htmlFor="name">
                  Full name <span>(Must be correct as it will be used on your certificate)</span>
                </label>
                <input id="name" type="text" placeholder="Enter name" />

                <label htmlFor="whatsapp">Whatsapp number</label>
                <input id="whatsapp" type="tel" placeholder="Enter number" />

                <label htmlFor="expectations">What are your expectations from NextGenForge?</label>
                <textarea id="expectations" rows="5" placeholder="Enter"></textarea>

                <div className="form-actions">
                  <button className="clear-btn" type="reset">
                    Clear form
                  </button>
                  <button className="next-btn" type="button" onClick={() => setCurrentStep(2)}>
                    Next
                  </button>
                </div>
              </form>
            </>
          ) : currentStep === 2 ? (
            <>
              {isMobile && (
                <h2>
                  Fill this form to secure your spot
                  <br />
                  and start your journey into AI.
                </h2>
              )}

              <form className="form step-two-form" onSubmit={(event) => event.preventDefault()}>
                <label htmlFor="selectionReason">
                  We prioritize committed participants. Why should you be selected?
                </label>
                <textarea id="selectionReason" rows="6" placeholder="Enter"></textarea>

                <label htmlFor="referrer">Who referred you?</label>
                <input id="referrer" type="text" placeholder="Enter" />

                <fieldset className="proficiency-group">
                  <legend>What is your proficiency level?</legend>

                  <label className="proficiency-option" htmlFor="proficiencyBeginner">
                    <input id="proficiencyBeginner" name="proficiency" type="radio" value="beginner" />
                    <span>Beginner - No idea on how AI Agents are built</span>
                  </label>

                  <label className="proficiency-option" htmlFor="proficiencyIntermediate">
                    <input
                      id="proficiencyIntermediate"
                      name="proficiency"
                      type="radio"
                      value="intermediate"
                    />
                    <span>Intermediate - Have some idea about how Agentic AIs are built</span>
                  </label>

                  <label className="proficiency-option" htmlFor="proficiencyExpert">
                    <input id="proficiencyExpert" name="proficiency" type="radio" value="expert" />
                    <span>Expert - Looking at expanding my skills to be a lot better and monetise</span>
                  </label>
                </fieldset>

                <div className="form-actions">
                  <button className="clear-btn" type="reset">
                    Clear form
                  </button>
                  <button className="next-btn" type="button" onClick={() => setCurrentStep(3)}>
                    Next
                  </button>
                </div>
              </form>
            </>
          ) : (
            <>
              {isMobile && (
                <h2>
                  Fill this form to secure your spot
                  <br />
                  and start your journey into AI.
                </h2>
              )}

              <form className="form step-three-form" onSubmit={(event) => event.preventDefault()}>
                <fieldset className="question-group">
                  <legend>Do you want to actively enrol for this batch?</legend>
                  <label className="question-option" htmlFor="enrolNo">
                    <input id="enrolNo" name="enrolmentChoice" type="radio" value="no" />
                    <span>No</span>
                  </label>
                  <label className="question-option" htmlFor="enrolYes">
                    <input id="enrolYes" name="enrolmentChoice" type="radio" value="yes" />
                    <span>Yes</span>
                  </label>
                </fieldset>

                <fieldset className="question-group">
                  <legend>Have you ever been trained on any Agentic AI platform before?</legend>
                  <label className="question-option" htmlFor="trainedYes">
                    <input id="trainedYes" name="trainedBefore" type="radio" value="yes" />
                    <span>Yes</span>
                  </label>
                  <label className="question-option" htmlFor="trainedNo">
                    <input id="trainedNo" name="trainedBefore" type="radio" value="no" />
                    <span>No</span>
                  </label>
                  <label className="question-option" htmlFor="trainedMaybe">
                    <input id="trainedMaybe" name="trainedBefore" type="radio" value="maybe" />
                    <span>Maybe</span>
                  </label>
                </fieldset>

                <fieldset className="question-group">
                  <legend>How many hours can you commit to training per day?</legend>
                  <label className="question-option" htmlFor="hoursOne">
                    <input id="hoursOne" name="dailyHours" type="radio" value="1hr" />
                    <span>1hr</span>
                  </label>
                  <label className="question-option" htmlFor="hoursTwo">
                    <input id="hoursTwo" name="dailyHours" type="radio" value="2hrs" />
                    <span>2hrs</span>
                  </label>
                  <label className="question-option" htmlFor="hoursMore">
                    <input id="hoursMore" name="dailyHours" type="radio" value="2hrPlus" />
                    <span>2hr +</span>
                  </label>
                </fieldset>

                <fieldset className="question-group payment-group">
                  <legend>This is a paid program ($50). Are you ready to proceed with payment?</legend>
                  <p>Once we receive your payment, you will be added automatically to our slack channel</p>
                  <label className="question-option" htmlFor="paymentReady">
                    <input id="paymentReady" name="paymentChoice" type="radio" value="earlyRegistration" />
                    <span>Yes I'm ready - US$50 (Early Registration)</span>
                  </label>
                  <label className="question-option" htmlFor="paymentInstallment">
                    <input id="paymentInstallment" name="paymentChoice" type="radio" value="installment" />
                    <span>Can I pay on Installment - US$30</span>
                  </label>
                  <label className="question-option" htmlFor="paymentTeam">
                    <input id="paymentTeam" name="paymentChoice" type="radio" value="team" />
                    <span>Pay for a team of three - US$120</span>
                  </label>
                </fieldset>

                <div className="form-actions">
                  <button className="clear-btn" type="reset">
                    Clear form
                  </button>
                  <button className="next-btn" type="submit">
                    {isMobile ? 'Next' : 'Done'}
                  </button>
                </div>
              </form>
            </>
          )}
          </section>
        )}
      </section>
    </main>
  )
}

export default App
